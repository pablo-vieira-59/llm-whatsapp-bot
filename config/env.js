require('dotenv').config();

const required = [
  'OPENROUTER_API_KEY',
  'GEMINI_API_KEY',
  'LMSTUDIO_URL',
  'COMFYUI_URL'
];

required.forEach(key => {
  if (!process.env[key]) {
    throw new Error(`${key} não definida no .env`);
  }
});