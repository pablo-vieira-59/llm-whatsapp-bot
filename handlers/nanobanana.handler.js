const { askNanoBanana } = require("../services/nanobanana.service");
const { MessageMedia } = require('whatsapp-web.js');

async function handleNanoBanana(msg) {
    const chat = await msg.getChat();
    chat.sendStateTyping();
    const prompt = msg.body.replace('!ocobanana ', '');
    msg.reply('Estou gerando a imagem, aguarde um momento ...');

    try {
        const result = askNanoBanana(prompt);

        let imagePart = result.candidates[0].content.parts.find(part => part.inlineData);

        if (imagePart) {
            const base64Data = imagePart.inlineData.data;
            const mimeType = imagePart.inlineData.mimeType;

            const media = new MessageMedia(mimeType, base64Data, "imagem_gerada.png");

            await chat.sendMessage(media, {
                caption: "",
                quotedMessageId: msg.id._serialized
            });
        } else {
            await msg.reply("O Gemini não gerou uma imagem. Talvez o prompt seja proibido ou inválido.");
        }
    }
    catch (error) {
        console.error(error);
        await msg.reply("Desculpa, deu erro ao gerar imagem com o Nano Banana.");
    }
}

module.exports = { handleNanoBanana };