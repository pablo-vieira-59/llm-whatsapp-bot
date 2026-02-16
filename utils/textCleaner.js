function removeThinkTags(text) {
  return text
    .replace(/<think[^>]*>[\s\S]*?<\/think>/gi, '')
    .trim();
}

module.exports = { removeThinkTags };