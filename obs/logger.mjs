import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

// Structured JSON-lines logger. Each call appends one line: {ts, level, ...event}.
export function createLogger(path = '.hermes/log.jsonl') {
  return function log(level, event) {
    const line = JSON.stringify({ ts: new Date().toISOString(), level, ...event })
    const dir = dirname(path)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    appendFileSync(path, line + '\n')
    return line
  }
}

export function readLog(path = '.hermes/log.jsonl') {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l))
}
