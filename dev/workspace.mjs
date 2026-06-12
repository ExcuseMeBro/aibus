import { rmSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export function workspacePath(issueId, base = '.hermes/work') {
  return join(base, issueId)
}

// Fresh, empty workspace for an issue (wipes any prior contents).
export function prepWorkspace(issueId, base = '.hermes/work') {
  const path = workspacePath(issueId, base)
  if (existsSync(path)) rmSync(path, { recursive: true, force: true })
  mkdirSync(path, { recursive: true })
  return path
}
