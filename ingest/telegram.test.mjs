import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filter, toSignal, parseUpdates } from './telegram.mjs'

const groupChatter = { chat: { id: -10, type: 'group' }, text: 'lunch?', message_id: 1, from: { username: 'al' }, date: 1700000000 }
const groupMention = { chat: { id: -10, type: 'supergroup' }, text: '@brodyone_bot fix login bug', message_id: 2, from: { username: 'al' }, date: 1700000000 }
const groupCommand = { chat: { id: -10, type: 'group' }, text: '/task add dark mode', message_id: 3, from: { username: 'al' }, date: 1700000000 }
const dm = { chat: { id: 55, type: 'private' }, text: 'hello', message_id: 4, from: { username: 'al' }, date: 1700000000 }

test('filter: group chatter rejected', () => {
  assert.equal(filter(groupChatter), false)
})
test('filter: group @mention accepted', () => {
  assert.equal(filter(groupMention), true)
})
test('filter: group /task command accepted', () => {
  assert.equal(filter(groupCommand), true)
})
test('filter: bot DM always accepted', () => {
  assert.equal(filter(dm), true)
})
test('filter: missing text rejected', () => {
  assert.equal(filter({ chat: { id: 1, type: 'group' } }), false)
})

test('toSignal strips mention/command, sets ISO UTC ts', () => {
  const s = toSignal(groupMention)
  assert.equal(s.chat_id, -10)
  assert.equal(s.msg_id, 2)
  assert.equal(s.from, 'al')
  assert.equal(s.text, 'fix login bug')
  assert.equal(s.ts, '2023-11-14T22:13:20.000Z')
})

test('parseUpdates returns fresh signals + nextOffset', () => {
  const json = { ok: true, result: [
    { update_id: 100, message: groupChatter },
    { update_id: 101, message: groupCommand },
  ] }
  const { signals, nextOffset } = parseUpdates(json)
  assert.equal(signals.length, 1)
  assert.equal(signals[0].text, 'add dark mode')
  assert.equal(nextOffset, 102)
})

test('parseUpdates empty result → no signals, null offset', () => {
  const { signals, nextOffset } = parseUpdates({ ok: true, result: [] })
  assert.deepEqual(signals, [])
  assert.equal(nextOffset, null)
})
