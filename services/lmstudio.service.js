const { lmstudio } = require('../config/ai.config');

async function askLMStudio(messages) {
  const completion = await lmstudio.chat.completions.create({
    model: "",
    messages,
    temperature: 0.9,
  });

  return completion.choices[0].message.content;
}

module.exports = { askLMStudio };