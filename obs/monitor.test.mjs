import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findStuck } from './monitor.mjs'

const now = Date.parse('2026-06-12T12:00:00.000Z')
const hourAgo = '2026-06-12T11:00:00.000Z'
const justNow = '2026-06-12T11:59:00.000Z'

test('old non-terminal issue is stuck', () => {
  const issues = [{ id: 'ISS-1', state: 'in_dev', ts: hourAgo }]
  const stuck = findStuck(issues, { maxAgeMs: 30 * 60 * 1000, now })
  assert.equal(stuck.length, 1)
})

test('fresh issue is not stuck', () => {
  const issues = [{ id: 'ISS-2', state: 'in_dev', ts: justNow }]
  assert.equal(findStuck(issues, { maxAgeMs: 30 * 60 * 1000, now }).length, 0)
})

test('terminal (staged) issue never stuck even if old', () => {
  const issues = [{ id: 'ISS-3', state: 'staged', ts: hourAgo }]
  assert.equal(findStuck(issues, { maxAgeMs: 30 * 60 * 1000, now }).length, 0)
})

test('issue with missing/bad ts is treated as stuck', () => {
  const issues = [{ id: 'ISS-4', state: 'in_dev' }]
  assert.equal(findStuck(issues, { maxAgeMs: 30 * 60 * 1000, now }).length, 1)
})

test('issue aged exactly maxAgeMs is not stuck (strict >)', () => {
  const issues = [{ id: 'ISS-5', state: 'in_dev', ts: '2026-06-12T11:30:00.000Z' }]
  assert.equal(findStuck(issues, { maxAgeMs: 30 * 60 * 1000, now }).length, 0)
})
