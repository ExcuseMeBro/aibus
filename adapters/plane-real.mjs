// Real Plane adapter — same interface as FakePlane, so pipeline.mjs runs
// unchanged. Strategy: keep the pipeline STAGE locally (Plane's state-group needs
// per-project UUIDs that are fragile to resolve headlessly) while mirroring the
// human-visible record (issue + stage comments) into Plane over REST.
//
// So: local json = operational truth for the state machine; Plane = the record a
// human sees. createIssue POSTs to Plane; updateIssue posts a stage comment.
// fetchFn is injectable for tests.

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

const PRIORITY = new Set(['urgent', 'high', 'medium', 'low', 'none'])

export class RealPlane {
  constructor(opts = {}) {
    this.base = (opts.baseUrl || process.env.PLANE_BASE_URL || '').replace(/\/$/, '')
    this.apiKey = opts.apiKey || process.env.PLANE_API_KEY
    this.slug = opts.slug || process.env.PLANE_WORKSPACE_SLUG
    this.project = opts.project || process.env.PLANE_PROJECT_ID
    this.fetchFn = opts.fetchFn || fetch
    this.path = opts.path || '.hermes/real/plane.json'
    if (!this.base || !this.apiKey || !this.slug || !this.project) {
      throw new Error('RealPlane: PLANE_BASE_URL, PLANE_API_KEY, PLANE_WORKSPACE_SLUG, PLANE_PROJECT_ID all required')
    }
  }
  _db() { return load(this.path) }
  _api(pathSuffix, init = {}) {
    const url = `${this.base}/api/v1/workspaces/${this.slug}/projects/${this.project}/${pathSuffix}`
    return this.fetchFn(url, {
      ...init,
      headers: { 'x-api-key': this.apiKey, 'content-type': 'application/json', ...(init.headers || {}) },
    })
  }

  async createIssue({ title, description = '', type = 'feature', priority = 'medium', state = 'triage', acceptance = [], ...rest }) {
    const p = PRIORITY.has(priority) ? priority : 'medium'
    const acText = acceptance.length ? `\n\nAcceptance:\n- ${acceptance.join('\n- ')}` : ''
    const body = {
      name: title.slice(0, 250),
      description_html: `<p>${escapeHtml(description)}${escapeHtml(`  [type:${type}]`)}</p><p>${escapeHtml(acText)}</p>`,
      priority: p,
    }
    let planeId = null
    try {
      const res = await this._api('issues/', { method: 'POST', body: JSON.stringify(body) })
      if (res.ok) { const j = await res.json(); planeId = j.id || j.pk || null }
    } catch { /* mirror-only failure must not lose the issue; keep local record */ }

    const db = this._db()
    const id = `ISS-${++db.seq}`
    db.issues[id] = { id, planeId, title, description, type, priority: p, state, acceptance, sub: [], ts: new Date().toISOString(), ...rest }
    save(this.path, db)
    return db.issues[id]
  }

  getIssue(id) { return this._db().issues[id] || null }

  updateIssue(id, patch) {
    const db = this._db()
    if (!db.issues[id]) throw new Error(`no issue ${id}`)
    db.issues[id] = { ...db.issues[id], ...patch }
    save(this.path, db)
    // Mirror stage changes to Plane as a comment (best-effort, non-blocking).
    if (patch.state && db.issues[id].planeId) {
      this._api(`issues/${db.issues[id].planeId}/comments/`, {
        method: 'POST',
        body: JSON.stringify({ comment_html: `<p>stage → <b>${escapeHtml(patch.state)}</b></p>` }),
      }).catch(() => {})
    }
    return db.issues[id]
  }

  listIssues(filter = {}) {
    return Object.values(this._db().issues).filter(i =>
      Object.entries(filter).every(([k, v]) => i[k] === v))
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
}
