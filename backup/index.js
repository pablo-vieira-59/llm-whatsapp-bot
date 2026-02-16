require('dotenv').config();

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { OpenAI } = require("openai");
const axios = require('axios');
const fs = require('fs');

// CONFIGURAÇÃO OPENAI
if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY não definida no .env");
}

const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
});

// CONFIGURAÇÃO LM STUDIO
if (!process.env.LMSTUDIO_URL) {
    throw new Error("LMSTUDIO_URL não definida no .env");
}

const lmstudio = new OpenAI({
    baseURL: `http://${process.env.LMSTUDIO_URL}/v1`,
    apiKey: 'lm-studio',
});

// CONFIGURAÇÃO DO GEMINI
if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY não definida no .env");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
const nanoBanana = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image" });

async function buildChatHistory(chat, limit = 200) {
    const messages = await chat.fetchMessages({ limit });

    console.log(`Recuperadas ${messages.length} mensagens do grupo: ${chat.name}`);

    const formatted = await Promise.all(
        messages
            .filter(m => m.body)
            .map(async (m) => {
                let nome = m.fromMe ? 'OcoGPT' : (m._data?.notifyName || 'Desconhecido');
                return `${nome}: ${m.body}`;
            })
    );

    const result = formatted.join('\n').slice(-10000);
    //console.log(result);
    return result;
}

async function waitForCompletion(promptId, timeout = 180000, interval = 2000) {
    const start = Date.now();

    while (true) {
        // Timeout
        if (Date.now() - start > timeout) {
            throw new Error("Tempo esgotado esperando o ComfyUI.");
        }

        try {
            const res = await axios.get(
                `http://${process.env.COMFYUI_URL}/history/${promptId}`
            );

            const history = res.data;

            if (history[promptId] && history[promptId].outputs) {
                return history[promptId].outputs;
            }

        } catch (err) {
            console.log("Ainda não pronto...");
        }

        await new Promise(r => setTimeout(r, interval));
    }
}

async function generateComfyImage(promptText) {
    const workflowRaw = fs.readFileSync('./workflow_api.json', 'utf-8');
    let workflow = JSON.parse(workflowRaw);

    const positiveNodeId = "8";
    if (workflow[positiveNodeId]) {
        workflow[positiveNodeId].inputs.text = promptText;
    }

    // Envia prompt
    const response = await axios.post(
        `http://${process.env.COMFYUI_URL}/prompt`,
        { prompt: workflow }
    );

    const promptId = response.data.prompt_id;

    // Espera finalizar
    const outputs = await waitForCompletion(promptId);

    // Encontra o node que tem imagem
    const nodeOutput = Object.values(outputs).find(o => o.images);

    if (!nodeOutput) {
        throw new Error("Nenhuma imagem encontrada.");
    }

    const fileName = nodeOutput.images[0].filename;

    // Baixa imagem
    const imgRes = await axios.get(
        `http://${process.env.COMFYUI_URL}/view?filename=${fileName}&type=output`,
        { responseType: 'arraybuffer' }
    );

    return {
        buffer: Buffer.from(imgRes.data).toString('base64'),
        mimeType: 'image/png'
    };
}

// Inicia o cliente do WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(), // Salva a sessão para não ter que ler QR code sempre
    puppeteer: {
        args: ['--no-sandbox'] // Necessário se rodar em servidor Linux
    }
});

// Gera o QR Code no terminal
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Escaneie o QR Code acima com seu WhatsApp!');
});

client.on('ready', () => {
    console.log('Tudo pronto! O Bot está conectado.');
});

// Ouvindo mensagens
client.on('message_create', async (msg) => {
    console.log(msg._data?.notifyName + ":" + msg.body);

    // Versão Gemini
    if (msg.body.startsWith('!ocogpt ')) {
        const chat = await msg.getChat();
        chat.sendStateTyping();
        // Obtem historico do chat
        const history = await buildChatHistory(chat);

        const prompt = msg.body.replace('!ocogpt ', '');

        try {
            var finalPrompt = prompt + "\n \n Aqui está um historico de mensagens caso seja necessário, caso não seja, ignore \n \n";
            finalPrompt += history;
            finalPrompt += "\n Sua resposta deve conter apenas 100 palavras por padrao, responda com mais palavras caso seja explicitamente solicitado.";

            // Pergunta ao Gemini
            const result = await model.generateContent(finalPrompt);
            const response = await result.response;
            const text = response.text();

            // Responde no WhatsApp (marcando a mensagem original)
            await msg.reply(text);

        } catch (error) {
            console.error(error);
            await msg.reply('Desculpe, deu erro ao falar com o Gemini.');
        }
    }

    // Versão ChatGPT
    if (msg.body.startsWith('!ocogptv2 ')) {
        const chat = await msg.getChat();
        chat.sendStateTyping();
        // Obtem historico do chat
        const history = await buildChatHistory(chat);

        const prompt = msg.body.replace('!ocogptv2 ', '');

        try {
            // Chamada para a API (OpenAI/LM Studio)
            const completion = await openai.chat.completions.create({
                model: "openai/gpt-oss-120b", // O LM Studio usa o que estiver carregado
                messages: [
                    {
                        role: "system",
                        content: "Seu nome é OcoGPT. Você é um assistente para um grupo de WhatsApp.Suas mensagens devem conter no maximo 100 palavras."
                    },
                    {
                        role: "user",
                        content: prompt + "\n \n Aqui está um historico de mensagens caso seja necessário, caso não seja, ignore \n \n" + history
                    }
                ],
                temperature: 0.9, // Mais alto = mais criatividade/caos
            });

            const result = completion.choices[0].message.content;

            await msg.reply(result);

        } catch (error) {
            console.error("Erro na API:", error);
            await msg.reply('OcoGPT está ocupado demais para você agora. (Erro na API)');
        }
    }

    // Versão L Studio
    if (msg.body.startsWith('!ocogptv3 ')) {
        const chat = await msg.getChat();
        chat.sendStateTyping();
        // Obtem historico do chat
        const history = await buildChatHistory(chat);

        const prompt = msg.body.replace('!ocogptv3 ', '');

        try {
            // Chamada para a API (LM Studio)
            const completion = await lmstudio.chat.completions.create({
                model: "", // O LM Studio usa o que estiver carregado
                messages: [
                    {
                        role: "system",
                        content: "Seu nome é OcoGPT. Você é um assistente para um grupo de WhatsApp.Suas mensagens devem conter no maximo 120 palavras."
                    },
                    {
                        role: "user",
                        content: prompt + "\n \n Aqui está um historico de mensagens caso seja necessário, caso não seja, ignore \n \n" + history
                    }
                ],
                temperature: 0.9, // Mais alto = mais criatividade/caos
            });

            var resposta = completion.choices[0].message.content;
            resposta = resposta.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

            await msg.reply(resposta);

        } catch (error) {
            console.error("Erro na API:", error);
            await msg.reply('OcoGPT está ocupado demais para você agora. (Erro na API)');
        }
    }

    // Versão NanoBanana
    if (msg.body.startsWith('!ocobanana ')) {
        const chat = await msg.getChat();
        chat.sendStateTyping();
        const prompt = msg.body.replace('!ocobanana ', '');
        msg.reply('Estou gerando a imagem, aguarde um momento ...');

        try {
            const result = await nanoBanana.generateContent(prompt);

            const response = await result.response;

            // Procuramos a parte que contém a imagem nos candidatos
            let imagePart = response.candidates[0].content.parts.find(part => part.inlineData);

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
            await msg.reply("Deu erro aqui.");
        }

    }

    // Versão ComfyUI
    if (msg.body.startsWith('!ocoimagem ')) {
        const chat = await msg.getChat();
        chat.sendStateTyping();

        const prompt = msg.body.replace('!ocoimagem ', '');
        msg.reply('Estou gerando a imagem, aguarde um momento ...');

        try {
            // Chamada para a API (OpenAI/LM Studio)
            const completion = await openai.chat.completions.create({
                model: "openai/gpt-oss-120b", // O LM Studio usa o que estiver carregado
                messages: [
                    {
                        role: "system",
                        content: "You a translator.Your objective is translate the prompt to english.Answer with the translation only"
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
            await msg.reply('Deu erro, mals');
        }
    }
});

client.initialize();