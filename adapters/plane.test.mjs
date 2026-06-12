import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FakePlane } from './plane.mjs'

function fresh() {
  const dir = mkdtempSync(join(tmpdir(), 'plane-'))
  return { plane: new FakePlane(join(dir, 'plane.json')), dir }
}

test('createIssue assigns id + defaults state triage', () => {
  const { plane, dir } = fresh()
  try {
    const i = plane.createIssue({ title: 'Fix bug', type: 'bug', priority: 'high' })
    assert.ok(i.id)
    assert.equal(i.state, 'triage')
    assert.equal(i.title, 'Fix bug')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('updateIssue persists across reload', () => {
  const { plane, dir } = fresh()
  const path = join(dir, 'plane.json')
  try {
    const i = plane.createIssue({ title: 'X' })
    plane.updateIssue(i.id, { state: 'backlog' })
    const reloaded = new FakePlane(path)
    assert.equal(reloaded.getIssue(i.id).state, 'backlog')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('listIssues filters by state', () => {
  const { plane, dir } = fresh()
  try {
    plane.createIssue({ title: 'A' })
    const b = plane.createIssue({ title: 'B' })
    plane.updateIssue(b.id, { state: 'backlog' })
    assert.equal(plane.listIssues({ state: 'triage' }).length, 1)
    assert.equal(plane.listIssues({ state: 'backlog' }).length, 1)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
