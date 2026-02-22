const { generateComfyImage, editComfyImage } = require("../services/comfy.service");
const { openai } = require("../config/ai.config");
const { MessageMedia } = require('whatsapp-web.js');


async function handleComfy(msg) {
    const chat = await msg.getChat();
    chat.sendStateTyping();

    const prompt = msg.body.replace('!ocobanana ', '');
    msg.reply('Estou gerando a imagem, aguarde um momento ...');

    try {
        const completion = await openai.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages: [
                {
                    role: "system",
                    content: "You are a translator.Your objective is translate the prompt to english.Answer with the translation only"
                },
                {
                    role: "user",
                    content: "Translate the following: \n" + prompt
                }
            ],
            temperature: 0.9,
        });

        const resultPrompt = completion.choices[0].message.content;
        console.log(resultPrompt);

        if (!msg.hasMedia) {
            const result = await generateComfyImage(resultPrompt);
            const media = new MessageMedia(result.mimeType, result.buffer, "comfy_output.png");

            await chat.sendMessage(media, {
                caption: "",
                quotedMessageId: msg.id._serialized
            });
        }
        else {
            const media = await msg.downloadMedia();

            if (media && media.mimetype.startsWith('image/')) {
                const result = await editComfyImage(resultPrompt, msg);
                const resultMedia =  new MessageMedia(result.mimeType, result.buffer, "comfy_output.png");
                await chat.sendMessage(resultMedia, {
                caption: "",
                quotedMessageId: msg.id._serialized
            });
            } else {
                msg.reply("Formato de imagem inválida.")
            }
        }

    } catch (error) {
        console.error("Erro na API:", error);
        await msg.reply('Desculpa, deu erro ao gerar imagem no ComfyUI.');
    }
}

module.exports = { handleComfy };