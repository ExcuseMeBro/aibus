import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs'
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

test('workspace nested under an enclosing git repo stays isolated', () => {
  // Regression: git rev-parse walks UP and finds the parent repo; a workspace
  // under it must still get its OWN .git, not commit into the enclosing repo.
  const base = tempBase()
  try {
    // make `base` itself a git repo with a commit (the "enclosing" repo)
    execSync('git init -q', { cwd: base })
    execSync('git config user.email a@b.c && git config user.name t', { cwd: base })
    writeFileSync(join(base, 'root.txt'), 'root\n')
    execSync('git add -A && git commit -q -m root', { cwd: base })
    const rootHead = execSync('git rev-parse HEAD', { cwd: base, encoding: 'utf8' }).trim()

    const wsPath = prepWorkspace('ISS-1', base)
    writeFileSync(join(wsPath, 'feature.txt'), 'hi\n')
    const repo = new LocalRepo({ base })
    repo.openMR({ title: 'feat: x', branch: 'feature/x', issueId: 'ISS-1' })

    // workspace must have its own .git
    assert.ok(existsSync(join(wsPath, '.git')), 'workspace should have its own .git')
    // enclosing repo HEAD must be untouched (no commit leaked upward)
    const rootHeadAfter = execSync('git rev-parse HEAD', { cwd: base, encoding: 'utf8' }).trim()
    assert.equal(rootHeadAfter, rootHead, 'enclosing repo must not receive the workspace commit')
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
