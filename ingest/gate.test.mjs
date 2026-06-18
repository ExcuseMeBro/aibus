import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildGate, parseCallback, decide } from './gate.mjs'
import { parseRoles } from './roles.mjs'

test('buildGate: sendMessage payload with two inline buttons', () => {
  const p = buildGate({ gate: 'merge', gateId: 'ISS-7', title: 'Merge MR !42', summary: 'login fix', chatId: 555 })
  assert.equal(p.chat_id, 555)
  assert.match(p.text, /merge/i)
  assert.match(p.text, /Merge MR !42/)
  const row = p.reply_markup.inline_keyboard[0]
  assert.equal(row.length, 2)
  assert.equal(row[0].callback_data, 'g:merge:ISS-7:a')
  assert.equal(row[1].callback_data, 'g:merge:ISS-7:r')
})

test('parseCallback: valid gate callback → structured decision', () => {
  const update = {
    callback_query: {
      id: 'cb1',
      from: { id: 333 },
      data: 'g:merge:ISS-7:a',
      message: { chat: { id: 555 }, message_id: 9 },
    },
  }
  const c = parseCallback(update)
  assert.equal(c.gate, 'merge')
  assert.equal(c.gateId, 'ISS-7')
  assert.equal(c.decision, 'approve')
  assert.equal(c.userId, 333)
  assert.equal(c.callbackId, 'cb1')
})

test('parseCallback: reject token and non-gate callbacks', () => {
  assert.equal(parseCallback({ callback_query: { data: 'g:plan:X:r', from: { id: 1 }, id: 'c' } }).decision, 'reject')
  assert.equal(parseCallback({ callback_query: { data: 'other:thing', from: { id: 1 }, id: 'c' } }), null)
  assert.equal(parseCallback({ message: { text: 'hi' } }), null) // not a callback at all
})

test('decide: authorized role approves', () => {
  const map = parseRoles('{"333":"reviewer"}')
  const update = { callback_query: { id: 'c', from: { id: 333 }, data: 'g:merge:ISS-7:a' } }
  const d = decide(map, update)
  assert.equal(d.ok, true)
  assert.equal(d.authorized, true)
  assert.equal(d.gate, 'merge')
  assert.equal(d.decision, 'approve')
})

test('decide: wrong role is rejected with a reason', () => {
  const map = parseRoles('{"111":"pm"}')
  const update = { callback_query: { id: 'c', from: { id: 111 }, data: 'g:merge:ISS-7:a' } }
  const d = decide(map, update)
  assert.equal(d.ok, true)
  assert.equal(d.authorized, false)
  assert.match(d.reason, /role|ruxsat/i)
})

test('decide: non-gate callback → ok:false', () => {
  const d = decide({}, { callback_query: { data: 'noise', from: { id: 1 }, id: 'c' } })
  assert.equal(d.ok, false)
})
