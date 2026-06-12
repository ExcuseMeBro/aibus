import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { prepWorkspace } from '../dev/workspace.mjs'
import { LocalRepo } from './repo-git.mjs'

function tempBase() {
  return mkdtempSync(join(tmpdir(), 'hermes-git-'))
}

test('openMR creates branch, commits, returns open MR with truthy sha', () => {
  const base = tempBase()
  try {
    const wsPath = prepWorkspace('ISS-1', base)
    writeFileSync(join(wsPath, 'feature.txt'), 'hello\n')

    const repo = new LocalRepo({ base })
    const mr = repo.openMR({ title: 'feat: x', branch: 'feature/x', issueId: 'ISS-1' })

    assert.equal(mr.state, 'open')
    assert.ok(mr.sha, `sha should be truthy, got ${JSON.stringify(mr.sha)}`)
    assert.equal(mr.branch, 'feature/x')
    assert.equal(mr.issueId, 'ISS-1')
    assert.ok(mr.id, 'id should be truthy')

    // Verify real git: current branch should be feature/x
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: wsPath, encoding: 'utf8' }).trim()
    assert.equal(currentBranch, 'feature/x')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('mergeMR merges the branch and returns merged state', () => {
  const base = tempBase()
  try {
    const wsPath = prepWorkspace('ISS-1', base)
    writeFileSync(join(wsPath, 'feature.txt'), 'hello\n')

    const repo = new LocalRepo({ base })
    const mr = repo.openMR({ title: 'feat: x', branch: 'feature/x', issueId: 'ISS-1' })

    const merged = repo.mergeMR(mr)
    assert.equal(merged.state, 'merged')

    // Current branch should not be the feature branch anymore
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: wsPath, encoding: 'utf8' }).trim()
    assert.notEqual(currentBranch, 'feature/x')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})
