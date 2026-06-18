// Bidirectional telegram gate: render an approval prompt with inline buttons,
// parse the user's button press, and authorize it against role config.
// Pure logic only — network IO lives in gate-io.mjs. Pairs with roles.mjs.

import { canApprove, GATE_ROLE } from './roles.mjs'

// callback_data is capped at 64 bytes by Telegram → keep it compact:
//   g:<gate>:<gateId>:<a|r>
const DECISION = { a: 'approve', r: 'reject' }

// Build a sendMessage payload presenting one gate to a chat.
export function buildGate({ gate, gateId, title, summary, chatId }) {
  const owner = GATE_ROLE[gate] || '?'
  const text = `🚦 GATE: ${gate} (${owner})\n${title}${summary ? `\n\n${summary}` : ''}`
  return {
    chat_id: chatId,
    text,
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Approve', callback_data: `g:${gate}:${gateId}:a` },
        { text: '❌ Reject', callback_data: `g:${gate}:${gateId}:r` },
      ]],
    },
  }
}

// Parse one telegram update's callback_query into a gate decision, or null if
// it is not a gate button press.
export function parseCallback(update) {
  const cb = update?.callback_query
  if (!cb || typeof cb.data !== 'string') return null
  const m = cb.data.match(/^g:([^:]+):([^:]+):([ar])$/)
  if (!m) return null
  return {
    gate: m[1],
    gateId: m[2],
    decision: DECISION[m[3]],
    userId: cb.from?.id,
    callbackId: cb.id,
    chatId: cb.message?.chat?.id,
    messageId: cb.message?.message_id,
  }
}

// Parse + authorize. Returns { ok, authorized, ... , reason } so the caller can
// answerCallbackQuery and act (or surface a denial) without re-parsing.
export function decide(rolesMap, update) {
  const c = parseCallback(update)
  if (!c) return { ok: false, authorized: false, reason: 'not a gate callback' }
  const authorized = canApprove(rolesMap, c.userId, c.gate)
  const required = GATE_ROLE[c.gate]
  return {
    ok: true,
    authorized,
    ...c,
    reason: authorized ? 'authorized' : `denied: ${c.gate} gate needs role "${required ?? '?'}"`,
  }
}
