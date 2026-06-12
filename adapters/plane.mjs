import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname } from 'node:path'

function load(path) {
  if (!existsSync(path)) return { seq: 0, issues: {} }
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return { seq: 0, issues: {} } }
}
function save(path, data) {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, path)
}

export class FakePlane {
  constructor(path = '.hermes/fake/plane.json') { this.path = path }
  _db() { return load(this.path) }
  createIssue({ title, description = '', type = 'feature', priority = 'medium', state = 'triage', acceptance = [], ...rest }) {
    const db = this._db()
    const id = `ISS-${++db.seq}`
    db.issues[id] = { id, title, description, type, priority, state, acceptance, sub: [], ts: new Date().toISOString(), ...rest }
    save(this.path, db)
    return db.issues[id]
  }
  getIssue(id) { return this._db().issues[id] || null }
  updateIssue(id, patch) {
    const db = this._db()
    if (!db.issues[id]) throw new Error(`no issue ${id}`)
    db.issues[id] = { ...db.issues[id], ...patch }
    save(this.path, db)
    return db.issues[id]
  }
  listIssues(filter = {}) {
    return Object.values(this._db().issues).filter(i =>
      Object.entries(filter).every(([k, v]) => i[k] === v))
  }
}
