import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname } from 'node:path'

function load(path) {
  if (!existsSync(path)) return { seq: 0, protos: {} }
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return { seq: 0, protos: {} } }
}
function save(path, d) {
  mkdirSync(dirname(path), { recursive: true })
  const t = `${path}.tmp`; writeFileSync(t, JSON.stringify(d, null, 2)); renameSync(t, path)
}

export class FakeDesign {
  constructor(path = '.hermes/fake/design.json') { this.path = path }
  createPrototype({ issueId, title, notes = '' }) {
    const db = load(this.path)
    const ref = `PROTO-${++db.seq}`
    db.protos[ref] = { ref, issueId, title, notes, ts: new Date().toISOString() }
    save(this.path, db); return db.protos[ref]
  }
  getPrototype(ref) { return load(this.path).protos[ref] || null }
}
