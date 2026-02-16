const { askNanoBanana } = require("../services/nanobanana.service");
const { MessageMedia } = require('whatsapp-web.js');


async function handleNanoBanana(msg) {
    const chat = await msg.getChat();
    chat.sendStateTyping();
    const prompt = msg.body.replace('!ocobanana ', '');
    msg.reply('Estou gerando a imagem, aguarde um momento ...');

    try {
        const result = askNanoBanana(prompt);

        // Procuramos a parte que contém a imagem nos candidatos
        let imagePart = result.candidates[0].content.parts.find(part => part.inlineData);

        if (imagePart) {
            const base64Data = imagePart.inlineData.data;
            const mimeType = imagePart.inlineData.mimeType;

            // Criamos a mídia para o WhatsApp a partir do Base64 recebido
            const media = new MessageMedia(mimeType, base64Data, "imagem_gerada.png");

            // OcoGPT enviando a imagem com o estilo dele
            await chat.sendMessage(media, {
                caption: "Aqui está sua imagem. Não me peça mais nada, sem tempo irmão.",
                quotedMessageId: msg.id._serialized
            });
        } else {
            await msg.reply("O Gemini não gerou uma imagem. Talvez o prompt seja proibido ou inválido.");
        }
    }
    catch (error) {
        console.error("Erro na geração de imagem:", error);
        await msg.reply("Deu erro,mals");
    }
}

module.exports = { handleNanoBanana };