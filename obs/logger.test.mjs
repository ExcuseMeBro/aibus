import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLogger, readLog } from './logger.mjs'

test('log writes a JSON line with ts + level + fields', () => {
  const dir = mkdtempSync(join(tmpdir(), 'log-'))
  const path = join(dir, 'log.jsonl')
  try {
    const log = createLogger(path)
    log('info', { action: 'transition', issueId: 'ISS-1' })
    const entries = readLog(path)
    assert.equal(entries.length, 1)
    assert.equal(entries[0].level, 'info')
    assert.equal(entries[0].action, 'transition')
    assert.equal(entries[0].issueId, 'ISS-1')
    assert.ok(entries[0].ts)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('readLog appends across multiple calls', () => {
  const dir = mkdtempSync(join(tmpdir(), 'log-'))
  const path = join(dir, 'log.jsonl')
  try {
    const log = createLogger(path)
    log('info', { a: 1 }); log('error', { a: 2 })
    assert.equal(readLog(path).length, 2)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('readLog on missing file returns []', () => {
  assert.deepEqual(readLog('/nonexistent/nope.jsonl'), [])
})
