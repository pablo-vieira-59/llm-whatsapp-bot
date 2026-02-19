const { buildChatHistory } = require('../services/chatHistory.service');
const { askOpenAI } = require('../services/openai.service');
const { removeThinkTags } = require('../utils/textCleaner');

async function handleGPT(msg) {
  const chat = await msg.getChat();
  chat.sendStateTyping();

  try {
    const history = await buildChatHistory(chat);
    const prompt = msg.body.replace('!ocogptv2 ', '');

    const messages = [
      {
        role: "system",
        content: "Seu nome é OcoGPT. Você é um assistente para um grupo de WhatsApp.Suas mensagens devem conter no maximo 100 palavras."
      },
      {
        role: "user",
        content: prompt + "\n \n Aqui está um historico de mensagens caso seja necessário, caso não seja, ignore \n \n" + history
      }
    ];

    let resposta = await askOpenAI(messages);
    resposta = removeThinkTags(resposta);

    await msg.reply(resposta);
  }
  catch (error) {
    console.log(error)
    await msg.reply("Desculpe, deu erro ao falar com o GPT.");
  }

}

module.exports = { handleGPT };
