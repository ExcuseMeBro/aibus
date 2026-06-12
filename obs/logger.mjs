import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

// Structured JSON-lines logger. Each call appends one line: {...event, ts, level}.
// ts/level last so a stray event key cannot clobber the structured fields.
export function createLogger(path = '.hermes/log.jsonl') {
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true }) // once, at construction
  return function log(level, event) {
    const line = JSON.stringify({ ...event, ts: new Date().toISOString(), level })
    appendFileSync(path, line + '\n')
    return line
  }
}

export function readLog(path = '.hermes/log.jsonl') {
  if (!existsSync(path)) return []
  const out = []
  for (const l of readFileSync(path, 'utf8').split('\n')) {
    if (!l.trim()) continue
    try { out.push(JSON.parse(l)) } catch { /* skip corrupt line, never crash the reader */ }
  }
  return out
}
