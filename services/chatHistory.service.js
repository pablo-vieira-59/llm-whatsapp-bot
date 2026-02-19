async function buildChatHistory(chat, limit = 200) {
  const messages = await chat.fetchMessages({ limit });

  const formatted = messages
    .filter(m => m.body)
    .map(m => {
      const nome = m.fromMe
        ? 'OcoGPT'
        : (m._data?.notifyName || 'Desconhecido');

      return `${nome}: ${m.body}`;
    });

  //console.log(formatted.join('\n'));
  return formatted.join('\n').slice(-10000);
}

module.exports = { buildChatHistory };