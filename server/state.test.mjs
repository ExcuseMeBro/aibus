import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rmSync, writeFileSync } from 'node:fs'
import { State } from './state.mjs'

const tmp = () => `.hermes/test-state-${Math.round(process.hrtime()[1])}.json`

test('offset round-trips and defaults to 0', () => {
  const p = tmp()
  const s = new State(p)
  assert.equal(s.getOffset(), 0)
  s.setOffset(42)
  assert.equal(new State(p).getOffset(), 42)
  rmSync(p, { force: true })
})

test('putGate returns a unique id and getGate reads it back', () => {
  const p = tmp()
  const s = new State(p)
  const g1 = s.putGate({ issueId: 'ISS-1', gate: 'roadmap', chatId: 5 })
  const g2 = s.putGate({ issueId: 'ISS-2', gate: 'plan', chatId: 5 })
  assert.notEqual(g1, g2)
  assert.equal(s.getGate(g1).issueId, 'ISS-1')
  assert.equal(s.getGate(g1).gate, 'roadmap')
  assert.equal(s.openGates().length, 2)
  rmSync(p, { force: true })
})

test('delGate removes the pending gate', () => {
  const p = tmp()
  const s = new State(p)
  const g = s.putGate({ issueId: 'ISS-1', gate: 'merge', chatId: 5 })
  assert.equal(s.delGate(g), true)
  assert.equal(s.getGate(g), null)
  assert.equal(s.delGate(g), false)
  rmSync(p, { force: true })
})

test('corrupted state file starts clean, never throws', () => {
  const p = tmp()
  writeFileSync(p, '{ not valid json')
  const s = new State(p)
  assert.equal(s.getOffset(), 0)
  assert.deepEqual(s.openGates(), [])
  rmSync(p, { force: true })
})
