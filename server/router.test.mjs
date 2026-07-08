import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classify, nextOffset } from './router.mjs'

const roles = { '999999': 'admin', '111111': 'pm' }

test('classify: a DM task message becomes a signal', () => {
  const u = { update_id: 1, message: { message_id: 3, date: 1700000000, chat: { id: 5, type: 'private' }, from: { username: 'bro' }, text: 'add dark mode' } }
  const r = classify(u, roles, 'brodyone_bot')
  assert.equal(r.kind, 'signal')
  assert.equal(r.signal.text, 'add dark mode')
  assert.equal(r.signal.chat_id, 5)
})

test('classify: an authorized gate button press', () => {
  const u = { callback_query: { id: 'cb1', from: { id: 111111 }, data: 'g:plan:G-7:a', message: { chat: { id: 5 }, message_id: 9 } } }
  const r = classify(u, roles, 'brodyone_bot')
  assert.equal(r.kind, 'gate')
  assert.equal(r.gate, 'plan')
  assert.equal(r.gateId, 'G-7')
  assert.equal(r.decision, 'approve')
  assert.equal(r.authorized, true)
})

test('classify: wrong-role gate press is parsed but not authorized', () => {
  const u = { callback_query: { id: 'cb2', from: { id: 111111 }, data: 'g:merge:G-8:a', message: { chat: { id: 5 } } } }
  const r = classify(u, roles, 'brodyone_bot')
  assert.equal(r.kind, 'gate')
  assert.equal(r.authorized, false) // pm cannot approve merge (needs reviewer)
})

test('classify: non-task group chatter is ignored', () => {
  const u = { message: { message_id: 1, date: 1700000000, chat: { id: -100, type: 'group' }, text: 'lunch?' } }
  assert.equal(classify(u, roles, 'brodyone_bot').kind, 'ignore')
})

test('nextOffset returns max id + 1, or null when empty', () => {
  assert.equal(nextOffset([{ update_id: 4 }, { update_id: 7 }]), 8)
  assert.equal(nextOffset([]), null)
})
