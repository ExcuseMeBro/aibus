import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FakeDocs } from './docs.mjs'

function fresh() {
  const dir = mkdtempSync(join(tmpdir(), 'docs-'))
  return { docs: new FakeDocs(join(dir, 'docs.json')), dir }
}

test('createPage returns pageId with body', () => {
  const { docs, dir } = fresh()
  try {
    const p = docs.createPage({ issueId: 'ISS-1', title: 'Release: X', body: 'notes' })
    assert.ok(p.pageId)
    assert.equal(p.issueId, 'ISS-1')
    assert.equal(p.body, 'notes')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('getPage persists across reload', () => {
  const { docs, dir } = fresh()
  const path = join(dir, 'docs.json')
  try {
    const p = docs.createPage({ issueId: 'ISS-1', title: 'T', body: 'b' })
    assert.equal(new FakeDocs(path).getPage(p.pageId).title, 'T')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
