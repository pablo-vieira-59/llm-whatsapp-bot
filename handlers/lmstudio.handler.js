const { buildChatHistory } = require('../services/chatHistory.service');
const { askLMStudio } = require('../services/lmstudio.service');
const { removeThinkTags } = require('../utils/textCleaner');

async function handleLMStudio(msg) {
  const chat = await msg.getChat();
  chat.sendStateTyping();

  try {
    const history = await buildChatHistory(chat);
    const prompt = msg.body.replace('!ocogptv3 ', '');

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

    let resposta = await askLMStudio(messages);
    resposta = removeThinkTags(resposta);

    await msg.reply(resposta);
  }
  catch (error) {
    console.log(error);
    msg.reply("Desculpa, deu erro ao falar com LMStudio.")
  }

}

module.exports = { handleLMStudio };
