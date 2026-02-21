const { generateComfyImage } = require("../services/comfy.service");
const { openai } = require("../config/ai.config");
const { MessageMedia } = require('whatsapp-web.js');


async function handleComfy(msg) {
    const chat = await msg.getChat();
    chat.sendStateTyping();

    const prompt = msg.body.replace('!ocobanana ', '');
    msg.reply('Estou gerando a imagem, aguarde um momento ...');

    try {
        // Chamada para a API (OpenAI/LM Studio)
        const completion = await openai.chat.completions.create({
            model: "openai/gpt-oss-120b", // O LM Studio usa o que estiver carregado
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
            temperature: 0.9, // Mais alto = mais criatividade/caos
        });

        const resultPrompt = completion.choices[0].message.content;
        console.log(resultPrompt);

        const result = await generateComfyImage(resultPrompt);
        const media = new MessageMedia(result.mimeType, result.buffer, "comfy_output.png");

        await chat.sendMessage(media, {
            caption: "",
            quotedMessageId: msg.id._serialized
        });
    } catch (error) {
        console.error("Erro na API:", error);
        await msg.reply('Desculpa, deu erro ao gerar imagem no ComfyUI.');
    }
}

module.exports = { handleComfy };