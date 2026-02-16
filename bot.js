const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const { handleGPT } = require('./handlers/gpt.handler');
const { handleLMStudio } = require('./handlers/lmstudio.handler');
const { handleGemini } = require('./handlers/gemini.handler');
const { handleNanoBanana } = require('./handlers/nanobanana.handler');
const { handleComfy } = require('./handlers/comfy.handler');
// importar outros handlers

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ['--no-sandbox'] }
});

client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('Bot conectado');
});

client.on('message_create', async (msg) => {
  if (typeof msg.body !== 'string') return;

  const nome = msg._data?.notifyName || 'Desconhecido';
  console.log(nome + ':' + msg.body);

  if (msg.body.startsWith('!ocogpt ')) {
    return handleGemini(msg);
  }
  if (msg.body.startsWith('!ocogptv2 ')) {
    return handleGPT(msg);
  }
  if (msg.body.startsWith('!ocogptv3 ')) {
    return handleLMStudio(msg);
  }
  if (msg.body.startsWith('!ocobanana ')) {
    return handleNanoBanana(msg);
  }
  if (msg.body.startsWith('!ocoimagem ')) {
    return handleComfy(msg);
  }

});

client.initialize();
