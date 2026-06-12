import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FakeRepo } from './repo.mjs'

function fresh() {
  const dir = mkdtempSync(join(tmpdir(), 'repo-'))
  return { repo: new FakeRepo(join(dir, 'repo.json')), dir }
}

test('openMR returns open MR tied to issue', () => {
  const { repo, dir } = fresh()
  try {
    const mr = repo.openMR({ title: 'feat: x', branch: 'feature/x', issueId: 'ISS-1' })
    assert.ok(mr.id)
    assert.equal(mr.state, 'open')
    assert.equal(mr.issueId, 'ISS-1')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('mergeMR flips state to merged', () => {
  const { repo, dir } = fresh()
  try {
    const mr = repo.openMR({ title: 't', branch: 'b', issueId: 'ISS-1' })
    repo.mergeMR(mr.id)
    assert.equal(repo.getMR(mr.id).state, 'merged')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
