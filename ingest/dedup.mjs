import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
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
  return new Set(JSON.parse(readFileSync(path, 'utf8')))
}

function save(set, path = SEEN_PATH) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify([...set]))
}

export function isSeen(fp, path = SEEN_PATH) {
  return load(path).has(fp)
}

export function markSeen(fp, path = SEEN_PATH) {
  const set = load(path)
  set.add(fp)
  save(set, path)
}
