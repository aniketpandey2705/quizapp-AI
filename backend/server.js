require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || 'dummy_key',
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:5173",
    "X-Title": "Plaquiz",
  }
});

const questionsPath = path.join(__dirname, 'data', 'questions.json');
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

  const { req, res, batchQuestions, resolve, reject } = requestQueue.shift();

  try {
    const results = [];
    const questionsToSolve = [];

    // Check cache
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

      const model = (headerModel && headerModel !== 'undefined') ? headerModel : process.env.OPENROUTER_MODEL;
      const apiKey = (headerApiKey && headerApiKey !== 'undefined') ? headerApiKey : process.env.OPENROUTER_API_KEY;

      if (!model) {
        throw new Error("OPENROUTER_MODEL not defined in environment or headers");
      }
      if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
        throw new Error("Invalid or missing OPENROUTER_API_KEY. Please provide it in Settings or .env file.");
      }

      let promptText = "You are a quantitative aptitude expert. Solve the following MCQ questions.\n\nFor each question:\n1. Identify correct answer (must exactly match one of the options provided)\n2. Show step-by-step solution\n3. Mention concept used\n\nKeep explanation clear and concise. \n\nIMPORTANT: Return ONLY a valid JSON array of objects. Do not include any text before or after the JSON. Ensure all quotes inside the 'explanation' or 'concept' strings are properly escaped with a backslash (\\). \n\nFormat per object: {'id': number, 'correctAnswer': 'string', 'explanation': 'string', 'concept': 'string'}\n\nQuestions:\n";
      
      questionsToSolve.forEach((q) => {
        promptText += `\nQuestion ID: ${q.id}\nText: ${q.text}\nOptions:\n${q.options ? q.options.join(', ') : "None"}\n---`;
      });

      console.log(`Sending batch to AI (${questionsToSolve.length} questions)...`);
      const completion = await openai.chat.completions.create({
        model: model,
        max_tokens: 3000,
        temperature: 0.1,
        // response_format: { type: "json_object" }, // Uncomment if using models that support this (needs 'json' in prompt)
        messages: [
          { role: "system", content: "You are a specialized mathematical assistant that returns strictly valid JSON arrays. Do not add conversational text. Ensure every JSON object is complete and valid." },
          { role: "user", content: promptText }
        ],
      });

      const message = completion.choices[0]?.message;
      if (!message || !message.content) {
        console.error("AI returned empty or null content:", completion);
        throw new Error("AI returned empty response. This might be due to content filtering or model limits.");
      }

      let aiResponseText = message.content.trim();
      console.log("AI Response received, length:", aiResponseText.length);
      
      // Cleanup json markdown if present
      if (aiResponseText.includes('```json')) {
        aiResponseText = aiResponseText.split('```json')[1].split('```')[0].trim();
      } else if (aiResponseText.includes('```')) {
        aiResponseText = aiResponseText.split('```')[1].split('```')[0].trim();
      }

      // Final attempt to find the array if there's still junk
      if (!aiResponseText.startsWith('[')) {
        const startIdx = aiResponseText.indexOf('[');
        const endIdx = aiResponseText.lastIndexOf(']');
        if (startIdx !== -1 && endIdx !== -1) {
          aiResponseText = aiResponseText.substring(startIdx, endIdx + 1);
        }
      }

      let aiResults;
      try {
        aiResults = JSON.parse(aiResponseText);
      } catch (e) {
        console.error("Failed to parse AI response as JSON. Original response head:", aiResponseText.substring(0, 100));
        console.error("Parse error:", e.message);
        throw new Error("AI returned invalid JSON format. Please try again.");
      }
      
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
    console.error("Backend solve-batch error:", error);
    reject(error);
  } finally {
    activeRequests--;
    // Still add a small delay to avoid hitting the API rate limit too hard
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

  // Wrap in a promise to handle queueing
  new Promise((resolve, reject) => {
    requestQueue.push({ req, res, batchQuestions, resolve, reject });
    processQueue();
  })
    .then(data => res.json(data))
    .catch(error => {
      console.error("Error solving batch:", error);
      res.status(500).json({ error: "Failed to generate solution", details: error.message });
    });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
