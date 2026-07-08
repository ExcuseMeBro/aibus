// Durable daemon state: which telegram gate message maps to which issue+stage,
// and the poll offset. Atomic writes (tmp+rename) so a crash mid-write never
// bricks the daemon. Pairs with server/hermesd.mjs.

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname } from 'node:path'

const STATE_PATH = '.hermes/state.json'

function load(path) {
  if (!existsSync(path)) return { seq: 0, offset: 0, gates: {} }
  try {
    const d = JSON.parse(readFileSync(path, 'utf8'))
    return { seq: d.seq || 0, offset: d.offset || 0, gates: d.gates || {} }
  } catch {
    return { seq: 0, offset: 0, gates: {} } // corrupted → start clean, never brick
  }
}

function save(path, data) {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, path)
}

export class State {
  constructor(path = STATE_PATH) { this.path = path }
  _d() { return load(this.path) }

  getOffset() { return this._d().offset }
  setOffset(n) { const d = this._d(); d.offset = Number(n) || 0; save(this.path, d) }

  // Register a pending gate, return its short id (`G-<n>`).
  putGate({ issueId, gate, chatId, messageId }) {
    const d = this._d()
    const gateId = `G-${++d.seq}`
    d.gates[gateId] = { issueId, gate, chatId, messageId, ts: new Date().toISOString() }
    save(this.path, d)
    return gateId
  }
  getGate(gateId) { return this._d().gates[gateId] || null }
  delGate(gateId) {
    const d = this._d()
    if (!d.gates[gateId]) return false
    delete d.gates[gateId]
    save(this.path, d)
    return true
  }
  openGates() { return Object.entries(this._d().gates).map(([id, g]) => ({ gateId: id, ...g })) }
}
