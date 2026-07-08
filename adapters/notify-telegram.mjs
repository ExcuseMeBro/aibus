// Real notify → telegram sendMessage. `to` is a telegram chat_id (falls back to
// HERMES_CHAT_ID for escalations that have no explicit target). fetch-injectable.

export class TelegramNotify {
  constructor(opts = {}) {
    this.token = opts.token || process.env.TELEGRAM_BOT_TOKEN
    this.defaultChat = opts.chatId || process.env.HERMES_CHAT_ID
    this.fetchFn = opts.fetchFn || fetch
  }
  async send(to, text) {
    const chat_id = to ?? this.defaultChat
    if (!this.token || chat_id == null) return false
    try {
      const res = await this.fetchFn(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id, text }),
      })
      const j = await res.json()
      return !!j.ok
    } catch {
      return false
    }
  }
}
