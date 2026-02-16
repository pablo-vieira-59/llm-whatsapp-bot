const { geminiImage } = require('../config/ai.config');

async function askNanoBanana(prompt) {
    const result = geminiImage.generateContent(prompt);
    const response = await result.response;
    return response;
}

module.exports = { askNanoBanana };