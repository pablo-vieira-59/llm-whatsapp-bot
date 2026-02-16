const { buildChatHistory } = require("../services/chatHistory.service");
const { askGemini } = require("../services/gemini.service");


async function handleGemini(msg) {
    const chat = await msg.getChat();
    chat.sendStateTyping();

    const history = await buildChatHistory(chat);
    const prompt = msg.body.replace('!ocogpt ', '');

    try {
        var finalPrompt = prompt + "\n \n Aqui está um historico de mensagens caso seja necessário, caso não seja, ignore \n \n";
        finalPrompt += history;
        finalPrompt += "\n Sua resposta deve conter apenas 100 palavras por padrao, responda com mais palavras caso seja explicitamente solicitado.";

        const text = await askGemini(finalPrompt);

        await msg.reply(text);

    } catch (error) {
        console.error(error);
        await msg.reply('Desculpe, deu erro ao falar com o Gemini.');
    }
}

module.exports = { handleGemini };