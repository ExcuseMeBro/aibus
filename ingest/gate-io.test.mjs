import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sendGate, ackCallback } from './gate-io.mjs'

// A fake fetch that records the call and returns a telegram-ok body.
function recorder(body = { ok: true, result: { message_id: 1 } }) {
  const calls = []
  const fetchFn = async (url, opts) => {
    calls.push({ url, opts, json: JSON.parse(opts.body) })
    return { json: async () => body }
  }
  return { fetchFn, calls }
}

test('sendGate: POSTs sendMessage with the payload', async () => {
  const { fetchFn, calls } = recorder()
  const payload = { chat_id: 5, text: 'hi', reply_markup: { inline_keyboard: [[]] } }
  const res = await sendGate('TOK', payload, fetchFn)
  assert.equal(res.ok, true)
  assert.equal(calls.length, 1)
  assert.match(calls[0].url, /\/botTOK\/sendMessage$/)
  assert.equal(calls[0].opts.method, 'POST')
  assert.equal(calls[0].json.chat_id, 5)
  assert.deepEqual(calls[0].json.reply_markup, payload.reply_markup)
})

test('ackCallback: POSTs answerCallbackQuery with id + text', async () => {
  const { fetchFn, calls } = recorder({ ok: true, result: true })
  await ackCallback('TOK', 'cb1', '✅ done', fetchFn)
  assert.match(calls[0].url, /\/botTOK\/answerCallbackQuery$/)
  assert.equal(calls[0].json.callback_query_id, 'cb1')
  assert.equal(calls[0].json.text, '✅ done')
})

test('sendGate: missing token throws (fail loud, not silent)', async () => {
  await assert.rejects(() => sendGate('', { chat_id: 1 }, async () => ({ json: async () => ({}) })), /token/i)
})
