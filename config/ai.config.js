const { OpenAI } = require("openai");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const lmstudio = new OpenAI({
  baseURL: `http://${process.env.LMSTUDIO_URL}/v1`,
  apiKey: 'lm-studio',
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

module.exports = {
  openai,
  lmstudio,
  geminiText: genAI.getGenerativeModel({ model: "gemini-flash-latest" }),
  geminiImage: genAI.getGenerativeModel({ model: "gemini-2.5-flash-image" })
};