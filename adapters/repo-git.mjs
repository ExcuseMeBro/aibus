import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { workspacePath } from '../dev/workspace.mjs'

function git(cwd, args) {
  return execSync(`git ${args}`, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim()
}

// Real local git in the issue workspace — branch + commit. No remote (credless).
export class LocalRepo {
  constructor({ base = '.hermes/work' } = {}) {
    this.base = base
  }

  _ensureRepo(cwd) {
    // Check for the workspace's OWN .git directly — `git rev-parse` walks UP and
    // would find an enclosing repo (e.g. Hermes itself), causing commits to land
    // in the parent repo. A direct existence check keeps the workspace isolated.
    if (!existsSync(join(cwd, '.git'))) {
      git(cwd, 'init -q')
      git(cwd, 'config user.email hermes@local')
      git(cwd, 'config user.name Hermes')
    }
    try { git(cwd, 'rev-parse HEAD') } catch {
      git(cwd, 'add -A')
      git(cwd, 'commit -q --allow-empty -m "chore: init workspace"')
    }
  }

  openMR({ title, branch, issueId }) {
    const cwd = workspacePath(issueId, this.base)
    this._ensureRepo(cwd)
    git(cwd, `checkout -q -B ${branch}`)
    git(cwd, 'add -A')
    git(cwd, `commit -q --allow-empty -m "${title.replace(/"/g, "'")}"`)
    const sha = git(cwd, 'rev-parse --short HEAD')
    return { id: `MR-${sha}`, title, branch, issueId, sha, state: 'open' }
  }

  mergeMR(mr) {
    const cwd = workspacePath(mr.issueId, this.base)
    const def = git(cwd, "for-each-ref '--format=%(refname:short)' refs/heads")
      .split('\n').map(s => s.trim()).filter(Boolean).find(b => b !== mr.branch) || 'main'
    git(cwd, `checkout -q ${def}`)
    git(cwd, `merge -q --no-edit ${mr.branch}`)
    return { ...mr, state: 'merged' }
  }
}
