import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname } from 'node:path'

function load(path) {
  if (!existsSync(path)) return { seq: 0, mrs: {} }
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return { seq: 0, mrs: {} } }
}
function save(path, data) {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`; writeFileSync(tmp, JSON.stringify(data, null, 2)); renameSync(tmp, path)
}

export class FakeRepo {
  constructor(path = '.hermes/fake/repo.json') { this.path = path }
  _db() { return load(this.path) }
  openMR({ title, branch, issueId }) {
    const db = this._db()
    const id = `MR-${++db.seq}`
    db.mrs[id] = { id, title, branch, issueId, state: 'open', ts: new Date().toISOString() }
    save(this.path, db); return db.mrs[id]
  }
  getMR(id) { return this._db().mrs[id] || null }
  mergeMR(id) {
    const db = this._db()
    if (!db.mrs[id]) throw new Error(`no MR ${id}`)
    db.mrs[id].state = 'merged'; save(this.path, db); return db.mrs[id]
  }
}
