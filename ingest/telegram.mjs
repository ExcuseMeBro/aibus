const BOT_USERNAME = 'brodyone_bot'

export function filter(message, botUsername = BOT_USERNAME) {
  if (!message || typeof message.text !== 'string') return false
  if (message.chat?.type === 'private') return true
  const text = message.text
  const cmd = text.match(/^\/task(@(\w+))?(\s|$)/)
  if (cmd) {
    // bare /task, or /task@thisbot only — ignore commands aimed at other bots
    return !cmd[2] || cmd[2].toLowerCase() === botUsername.toLowerCase()
  }
  return text.includes(`@${botUsername}`)
}

export function toSignal(message, botUsername = BOT_USERNAME) {
  const text = (message.text || '')
    .replaceAll(`@${botUsername}`, '')
    .replace(/^\/task(@\w+)?\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return {
    chat_id: message.chat.id,
    msg_id: message.message_id,
    from: message.from?.username || message.from?.first_name || 'unknown',
    text,
    ts: new Date(message.date * 1000).toISOString(),
  }
}

export function parseUpdates(json, botUsername = BOT_USERNAME) {
  const updates = json?.result || []
  const signals = []
  let maxId = -1
  for (const u of updates) {
    if (typeof u.update_id === 'number') maxId = Math.max(maxId, u.update_id)
    const msg = u.message
    if (msg && filter(msg, botUsername)) {
      const s = toSignal(msg, botUsername)
      if (s.text) signals.push(s) // drop mention-only / empty-text noise
    }
  }
  return { signals, nextOffset: maxId >= 0 ? maxId + 1 : null }
}
