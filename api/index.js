require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const app = express();
app.use(cors({
  origin: ["https://quizapp-ai.vercel.app", "http://localhost:5173", "http://localhost:3000"],
  allowedHeaders: ["Content-Type", "x-api-key", "x-model"]
}));
app.use(express.json());

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: "MANUAL_ENTRY_REQUIRED", // Use the key from the frontend headers instead
  defaultHeaders: {
    "HTTP-Referer": "https://quizapp-ai.vercel.app",
    "X-Title": "Plaquiz AI",
  }
});

// For Vercel, use path.join(process.cwd(), 'api', 'data', 'questions.json') or similar
const questionsPath = path.join(process.cwd(), 'api', 'data', 'questions.json');
let questions = [];
try {
  const data = fs.readFileSync(questionsPath, 'utf8');
  questions = JSON.parse(data);
} catch (error) {
  console.error("Error reading questions.json:", error);
}

const solutionCache = new Map();
let activeRequests = 0;
const MAX_CONCURRENT = 3;
const requestQueue = [];

const processQueue = async () => {
  if (activeRequests >= MAX_CONCURRENT || requestQueue.length === 0) return;
  activeRequests++;

  const { req, batchQuestions, resolve, reject } = requestQueue.shift();

  try {
    const results = [];
    const questionsToSolve = [];

    for (const q of batchQuestions) {
      const cacheKey = q.id ? q.id.toString() : q.text;
      if (solutionCache.has(cacheKey)) {
        results.push(solutionCache.get(cacheKey));
      } else {
        questionsToSolve.push(q);
      }
    }

    if (questionsToSolve.length > 0) {
      const headerApiKey = req.headers['x-api-key'];
      const headerModel = req.headers['x-model'];

      const model = (headerModel && headerModel !== 'undefined' && headerModel !== '') ? headerModel : 'openai/gpt-3.5-turbo';
      const apiKey = (headerApiKey && headerApiKey !== 'undefined' && headerApiKey !== '') ? headerApiKey : null;

      if (!apiKey) {
        const err = new Error("AI Setup Required: Please provide your API Key in Settings.");
        err.status = 401;
        throw err;
      }

      let promptText = "You are a quantitative aptitude expert. Solve the following MCQ questions.\n\nFor each question:\n1. Identify correct answer (must exactly match one of the options provided)\n2. Show step-by-step solution\n3. Mention concept used\n\nKeep explanation clear and concise. \n\nIMPORTANT: Return ONLY a valid JSON array of objects. Do not include any text before or after the JSON. Ensure all quotes inside the 'explanation' or 'concept' strings are properly escaped with a backslash (\\). \n\nFormat per object: {'id': number, 'correctAnswer': 'string', 'explanation': 'string', 'concept': 'string'}\n\nQuestions:\n";
      
      questionsToSolve.forEach((q) => {
        promptText += `\nQuestion ID: ${q.id}\nText: ${q.text}\nOptions:\n${q.options ? q.options.join(', ') : "None"}\n---`;
      });

      const completion = await openai.chat.completions.create({
        model: model,
        max_tokens: 3000,
        temperature: 0.1,
        messages: [
          { role: "system", content: "You are a specialized mathematical assistant that returns strictly valid JSON arrays. Do not add conversational text. Ensure every JSON object is complete and valid." },
          { role: "user", content: promptText }
        ],
      }, {
        apiKey: apiKey // Dynamically use the key from the request headers
      });

      const message = completion.choices[0]?.message;
      if (!message || !message.content) {
        throw new Error("AI returned empty response.");
      }

      let aiResponseText = message.content.trim();
      
      if (aiResponseText.includes('```json')) {
        aiResponseText = aiResponseText.split('```json')[1].split('```')[0].trim();
      } else if (aiResponseText.includes('```')) {
        aiResponseText = aiResponseText.split('```')[1].split('```')[0].trim();
      }

      if (!aiResponseText.startsWith('[')) {
        const startIdx = aiResponseText.indexOf('[');
        const endIdx = aiResponseText.lastIndexOf(']');
        if (startIdx !== -1 && endIdx !== -1) {
          aiResponseText = aiResponseText.substring(startIdx, endIdx + 1);
        }
      }

      let aiResults = JSON.parse(aiResponseText);
      
      if (!Array.isArray(aiResults)) {
        throw new Error("AI response is not a JSON array.");
      }

      for (const resItem of aiResults) {
        const cacheKey = resItem.id ? resItem.id.toString() : null;
        if (cacheKey) {
          solutionCache.set(cacheKey, resItem);
        }
        results.push(resItem);
      }
    }

    resolve({ results });

  } catch (error) {
    reject(error);
  } finally {
    activeRequests--;
    setTimeout(processQueue, 200);
  }
};

app.get('/api/questions', (req, res) => {
  res.json(questions);
});

app.post('/api/solve-batch', (req, res) => {
  const { questions: batchQuestions } = req.body;
  if (!Array.isArray(batchQuestions) || batchQuestions.length === 0) {
    return res.status(400).json({ error: "Please provide an array of questions" });
  }

  new Promise((resolve, reject) => {
    requestQueue.push({ req, batchQuestions, resolve, reject });
    processQueue();
  })
    .then(data => res.json(data))
    .catch(error => {
      res.status(error.status || 500).json({ error: "Failed to generate solution", details: error.message });
    });
});

const PORT = process.env.PORT || 5000;
if (require.main === module || process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running locally on port ${PORT}`);
  });
}

module.exports = app;
