const fs = require('fs');

const text = fs.readFileSync('data/raw_questions.txt', 'utf-8');
const chunks = text.split(/\*\s+1 point/);

const questions = [];

for (let i = 0; i < chunks.length - 1; i++) {
  let qText;
  let options = [];
  
  if (i === 0) {
    qText = chunks[i].trim();
  } else {
    let lines = chunks[i].trim().split('\n').map(l => l.trim()).filter(l => l);
    let qStartIdx = lines.length - 1; // Default to last line
    
    for (let j = 0; j < lines.length; j++) {
      let l = lines[j];
      if (j >= 2) { // At least 2 options
        // Heuristics for question start
        if (
          l.endsWith('?') || 
          l.length > 50 || 
          /^(A|The|If|Find|What|In|Given|Six|Two|Three|Four|P|Kavi|Alpana|Express|A \+|Sudhir|There|How|16\.67|Simplify|Which|HCF|FIND|if|A,|When)\b/i.test(l) ||
          j >= 5 // Max 5 options
        ) {
          qStartIdx = j;
          break;
        }
      }
    }
    
    // Additional safety check
    if (qStartIdx === 0) qStartIdx = 1;
    
    options = lines.slice(0, qStartIdx);
    qText = lines.slice(qStartIdx).join('\n');
    questions[i-1].options = options;
  }
  
  if (i < chunks.length - 1) {
    questions.push({
      id: i + 1,
      text: qText,
      options: []
    });
  }
}

// Last chunk has options for the last question
if (chunks.length > 1) {
  let lastLines = chunks[chunks.length - 1].trim().split('\n').map(l => l.trim()).filter(l => l);
  questions[questions.length - 1].options = lastLines;
}

fs.writeFileSync('data/questions.json', JSON.stringify(questions, null, 2));
console.log(`Parsed ${questions.length} questions.`);
