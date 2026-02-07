require('dotenv').config();

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { OpenAI } = require("openai"); // Importa OpenAI

// CONFIGURAÇÃO OPENAI / LM STUDIO
if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY não definida no .env");
}

const openai = new OpenAI({
    // Se for usar LM Studio, mantenha a URL abaixo. 
    // Se for usar a API real da OpenAI, remova a linha baseURL ou use "https://api.openai.com/v1"
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY, // Para LM Studio, qualquer texto serve.
});

// CONFIGURAÇÃO DO GEMINI
if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY não definida no .env");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

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

    // O bot só responde se a mensagem começar com "!gemini"
    if (msg.body.startsWith('!ocogpt ')) {
        const prompt = msg.body.replace('!ocogpt ', '');
        const chat = await msg.getChat();

        // Avisa que está "escrevendo..." (efeito visual)
        chat.sendStateTyping();

        try {
            const messages = await chat.fetchMessages({ limit: 200 });

            console.log(`Recuperadas ${messages.length} mensagens do grupo: ${chat.name}`);

            // 1. Filtramos apenas mensagens que têm autor (ignora avisos de sistema)
            // e mensagens que possuem conteúdo de texto.
            const mensagensValidas = messages.filter(m => m.body);

            // 2. Mapeia as mensagens e busca o nome de cada autor
            const historicoComNomes = await Promise.all(mensagensValidas.map(async (m) => {
                try {
                    if (m.author) {
                        const contato = await m.getContact();
                        const nomeAutor = contato.pushname || contato.name || "Desconhecido";
                        return `${nomeAutor}: ${m.body}`;
                    }

                    return `OcoGPT: ${m.body}`;

                } catch (e) {
                    // Se falhar em um contato específico, retorna o ID ou 'Desconhecido'
                    return `Desconhecido: ${m.body}`;
                }
            }));

            // 3. Junta tudo em uma única string
            const textoFinal = historicoComNomes.join('\n');
            
            var finalPrompt = prompt + "\n \n Aqui está um historico de mensagens caso seja necessário, caso não seja, ignore \n \n";
            finalPrompt += textoFinal;
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

    if (msg.body.startsWith('!ocogptv2 ')) {
        const prompt = msg.body.replace('!ocogptv2 ', '');
        const chat = await msg.getChat();

        chat.sendStateTyping();

        try {
            // Aumentamos o limite para 200, mas vamos tratar o texto para não estourar o contexto
            const messages = await chat.fetchMessages({ limit: 200 });

            console.log(`Recuperadas ${messages.length} mensagens do grupo: ${chat.name}`);

            const historicoComNomes = await Promise.all(messages.filter(m => m.body).map(async (m) => {
                try {
                    if (m.author) {
                        const contato = await m.getContact();
                        const nomeAutor = contato.pushname || contato.name || "Desconhecido";
                        return `${nomeAutor}: ${m.body}`;
                    }
                    return `OcoGPT: ${m.body}`;
                } catch (e) {
                    return `Desconhecido: ${m.body}`;
                }
            }));

            // Inverte para as mais recentes ficarem por último e corta os últimos 10 mil caracteres
            const textoFinal = historicoComNomes.join('\n').slice(-10000);

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
                        content: prompt + "\n \n Aqui está um historico de mensagens caso seja necessário, caso não seja, ignore \n \n" + textoFinal
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