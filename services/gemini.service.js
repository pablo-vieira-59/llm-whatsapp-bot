const { geminiText } = require('../config/ai.config');

async function askGemini(prompt) {
  const result = await geminiText.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  return text;
}

module.exports = { askGemini };