import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname } from 'node:path'

function load(path) {
  if (!existsSync(path)) return { seq: 0, pages: {} }
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return { seq: 0, pages: {} } }
}
function save(path, d) {
  mkdirSync(dirname(path), { recursive: true })
  const t = `${path}.tmp`; writeFileSync(t, JSON.stringify(d, null, 2)); renameSync(t, path)
}

export class FakeDocs {
  constructor(path = '.hermes/fake/docs.json') { this.path = path }
  createPage({ issueId, title, body = '' }) {
    const db = load(this.path)
    const pageId = `DOC-${++db.seq}`
    db.pages[pageId] = { pageId, issueId, title, body, ts: new Date().toISOString() }
    save(this.path, db); return db.pages[pageId]
  }
  getPage(pageId) { return load(this.path).pages[pageId] || null }
}
