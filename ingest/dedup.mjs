import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname } from 'node:path'

const SEEN_PATH = '.hermes/seen.json'

export function normalize(text) {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function fingerprint(signal) {
  return createHash('sha256')
    .update(`${signal.chat_id}:${normalize(signal.text)}`)
    .digest('hex')
}

function load(path = SEEN_PATH) {
  if (!existsSync(path)) return new Set()
  try {
    return new Set(JSON.parse(readFileSync(path, 'utf8')))
  } catch {
    return new Set() // corrupted file → start fresh, never brick ingestion
  }
}

function save(set, path = SEEN_PATH) {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify([...set]))
  renameSync(tmp, path) // atomic on POSIX
}

export function isSeen(fp, path = SEEN_PATH) {
  return load(path).has(fp)
}

export function markSeen(fp, path = SEEN_PATH) {
  const set = load(path)
  set.add(fp)
  save(set, path)
}

// Single load/check/add/save — avoids TOCTOU between isSeen+markSeen.
// Returns true if fp was NEW (and is now recorded), false if already seen.
export function checkAndMark(fp, path = SEEN_PATH) {
  const set = load(path)
  if (set.has(fp)) return false
  set.add(fp)
  save(set, path)
  return true
}
