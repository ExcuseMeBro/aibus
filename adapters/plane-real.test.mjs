import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { RealPlane } from './plane-real.mjs'

const tmp = () => `.hermes/test-plane-${Math.round(process.hrtime()[1])}.json`
const opts = (fetchFn, path) => ({ baseUrl: 'https://plane.x', apiKey: 'k', slug: 'w', project: 'p', fetchFn, path })

test('constructor demands the four connection fields', () => {
  assert.throws(() => new RealPlane({ baseUrl: 'https://plane.x', fetchFn: () => {}, path: tmp() }), /required/)
})

test('createIssue POSTs to Plane and mirrors locally with planeId', async () => {
  const p = tmp()
  const calls = []
  const fetchFn = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) })
    return { ok: true, json: async () => ({ id: 'plane-uuid-1' }) }
  }
  const plane = new RealPlane(opts(fetchFn, p))
  const iss = await plane.createIssue({ title: 'Fix login', priority: 'high', type: 'bug', acceptance: ['no crash'] })
  assert.equal(iss.id, 'ISS-1')
  assert.equal(iss.planeId, 'plane-uuid-1')
  assert.match(calls[0].url, /\/api\/v1\/workspaces\/w\/projects\/p\/issues\/$/)
  assert.equal(calls[0].body.name, 'Fix login')
  assert.equal(calls[0].body.priority, 'high')
  assert.deepEqual(plane.getIssue('ISS-1').acceptance, ['no crash'])
  rmSync(p, { force: true })
})

test('createIssue keeps the local record even if Plane POST fails', async () => {
  const p = tmp()
  const fetchFn = async () => { throw new Error('network down') }
  const plane = new RealPlane(opts(fetchFn, p))
  const iss = await plane.createIssue({ title: 'offline case' })
  assert.equal(iss.id, 'ISS-1')
  assert.equal(iss.planeId, null) // Plane unreachable, but issue not lost
  rmSync(p, { force: true })
})

test('unknown priority is coerced to medium', async () => {
  const p = tmp()
  const fetchFn = async () => ({ ok: true, json: async () => ({ id: 'u' }) })
  const plane = new RealPlane(opts(fetchFn, p))
  const iss = await plane.createIssue({ title: 't', priority: 'BOGUS' })
  assert.equal(iss.priority, 'medium')
  rmSync(p, { force: true })
})

test('updateIssue persists patch and returns the merged issue', async () => {
  const p = tmp()
  const fetchFn = async () => ({ ok: true, json: async () => ({ id: 'u' }) })
  const plane = new RealPlane(opts(fetchFn, p))
  await plane.createIssue({ title: 't' })
  const up = plane.updateIssue('ISS-1', { state: 'planned' })
  assert.equal(up.state, 'planned')
  assert.equal(plane.getIssue('ISS-1').state, 'planned')
  rmSync(p, { force: true })
})
