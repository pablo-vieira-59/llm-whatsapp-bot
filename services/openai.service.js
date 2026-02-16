const { openai } = require('../config/ai.config');

async function askOpenAI(messages) {
  const completion = await openai.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages,
    temperature: 0.9,
  });

  return completion.choices[0].message.content;
}

module.exports = { askOpenAI };