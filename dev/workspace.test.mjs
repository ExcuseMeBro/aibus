import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { workspacePath, prepWorkspace } from './workspace.mjs'

function tempBase() {
  return mkdtempSync(join(tmpdir(), 'hermes-ws-'))
}

test('workspacePath returns path ending with issueId', () => {
  const base = tempBase()
  try {
    const p = workspacePath('ISS-1', base)
    assert.ok(p.endsWith('ISS-1'), `expected path ending with ISS-1, got ${p}`)
    assert.ok(p.startsWith(base), `expected path starting with base, got ${p}`)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('prepWorkspace creates an empty directory', () => {
  const base = tempBase()
  try {
    const p = prepWorkspace('ISS-1', base)
    assert.ok(existsSync(p), 'workspace dir should exist')
    // should be a directory (not throw on existsSync)
    assert.equal(p, workspacePath('ISS-1', base))
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('prepWorkspace wipes previous contents on second call', () => {
  const base = tempBase()
  try {
    const p = prepWorkspace('ISS-1', base)
    const file = join(p, 'leftover.txt')
    writeFileSync(file, 'should be gone')
    assert.ok(existsSync(file), 'file should exist before second prepWorkspace')

    prepWorkspace('ISS-1', base)
    assert.ok(!existsSync(file), 'file should be gone after second prepWorkspace')
    assert.ok(existsSync(p), 'workspace dir itself should still exist')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})
