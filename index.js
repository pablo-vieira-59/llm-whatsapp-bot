require('dotenv').config();

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { OpenAI } = require("openai");

// CONFIGURAÇÃO OPENAI / LM STUDIO
if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY não definida no .env");
}

const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
});

// CONFIGURAÇÃO DO GEMINI
if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY não definida no .env");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
const contactCache = new Map();

async function getAuthorName(m) {
    if (!m.author) return "OcoGPT";

    if (contactCache.has(m.author)) {
        return contactCache.get(m.author);
    }

    const contato = await m.getContact();
    const nome = contato.pushname || contato.name || "Desconhecido";

    contactCache.set(m.author, nome);
    return nome;
}

async function buildChatHistory(chat, limit = 200, maxChars = 10000) {
    const messages = await chat.fetchMessages({ limit });

    console.log(`Recuperadas ${messages.length} mensagens do grupo: ${chat.name}`);

    const formatted = await Promise.all(
        messages
            .filter(m => m.body)
            .map(async (m) => {
                try {
                    return getAuthorName(m);
                } catch {
                    return `Desconhecido: ${m.body}`;
                }
            })
    );

    return formatted.join('\n').slice(-maxChars);
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
    console.log(msg.body)
    const chat = await msg.getChat();

    chat.sendStateTyping();

    // Obtem historico do chat
    const history = buildChatHistory(chat);

    // Versão Gemini
    if (msg.body.startsWith('!ocogpt ')) {
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

            const resposta = completion.choices[0].message.content;

            await msg.reply(resposta);

        } catch (error) {
            console.error("Erro na API:", error);
            await msg.reply('OcoGPT está ocupado demais para você agora. (Erro na API)');
        }
    }
});

client.initialize();