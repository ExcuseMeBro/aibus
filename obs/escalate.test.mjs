import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escalate } from './escalate.mjs'

test('escalate notifies human and returns escalated', () => {
  const sent = []
  const notify = { send: (to, text) => { sent.push({ to, text }); return true } }
  const logged = []
  const log = (level, ev) => logged.push({ level, ev })
  const out = escalate({ notify, log }, { id: 'ISS-1', title: 'X' }, 'CI failed')
  assert.equal(out.escalated, true)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].to, 'human')
  assert.match(sent[0].text, /ISS-1/)
  assert.equal(logged[0].level, 'error')
})

test('escalate works without a logger (optional)', () => {
  const sent = []
  const notify = { send: (to, text) => { sent.push(text); return true } }
  const out = escalate({ notify }, { id: 'ISS-2', title: 'Y' }, 'stuck')
  assert.equal(out.escalated, true)
  assert.equal(sent.length, 1)
})
