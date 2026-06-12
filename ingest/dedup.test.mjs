import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { normalize, fingerprint, isSeen, markSeen, checkAndMark } from './dedup.mjs'

test('normalize trims, lowercases, collapses whitespace', () => {
  assert.equal(normalize('  Fix   The  BUG\n'), 'fix the bug')
})

test('fingerprint stable across case/whitespace, varies by chat', () => {
  const a = fingerprint({ chat_id: 1, text: 'Fix the bug' })
  const b = fingerprint({ chat_id: 1, text: '  fix   the BUG ' })
  const c = fingerprint({ chat_id: 2, text: 'Fix the bug' })
  assert.equal(a, b)
  assert.notEqual(a, c)
})

test('isSeen/markSeen persist across reload', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dedup-'))
  const path = join(dir, 'seen.json')
  const fp = 'abc123'
  try {
    assert.equal(isSeen(fp, path), false)
    markSeen(fp, path)
    assert.equal(isSeen(fp, path), true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('load tolerates corrupted seen.json (no crash)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dedup-'))
  const path = join(dir, 'seen.json')
  try {
    writeFileSync(path, '{ this is not valid json')
    assert.equal(isSeen('anyfp', path), false) // does not throw
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('checkAndMark returns true once then false', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dedup-'))
  const path = join(dir, 'seen.json')
  try {
    assert.equal(checkAndMark('fp1', path), true)
    assert.equal(checkAndMark('fp1', path), false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
