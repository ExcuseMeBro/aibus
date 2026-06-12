import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FakeDesign } from './design.mjs'

function fresh() {
  const dir = mkdtempSync(join(tmpdir(), 'design-'))
  return { design: new FakeDesign(join(dir, 'design.json')), dir }
}

test('createPrototype returns ref tied to issue', () => {
  const { design, dir } = fresh()
  try {
    const p = design.createPrototype({ issueId: 'ISS-1', title: 'Login UI', notes: 'dark' })
    assert.ok(p.ref)
    assert.equal(p.issueId, 'ISS-1')
    assert.equal(p.notes, 'dark')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('getPrototype persists across reload', () => {
  const { design, dir } = fresh()
  const path = join(dir, 'design.json')
  try {
    const p = design.createPrototype({ issueId: 'ISS-1', title: 'X' })
    assert.equal(new FakeDesign(path).getPrototype(p.ref).issueId, 'ISS-1')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
