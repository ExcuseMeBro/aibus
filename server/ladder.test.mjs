import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gateForState, advanceFromGate } from './ladder.mjs'

// Minimal in-memory plane + design/docs, plus scripted agents.
function ctxFor(issue) {
  const issues = { [issue.id]: { ...issue } }
  const plane = {
    getIssue: (id) => issues[id],
    updateIssue: (id, patch) => (issues[id] = { ...issues[id], ...patch }),
  }
  const design = { createPrototype: ({ issueId }) => ({ ref: `proto:${issueId}` }) }
  const docs = { createPage: ({ issueId }) => ({ pageId: `doc:${issueId}` }) }
  const agents = {
    pm: async () => [{ title: 'sub 1' }, { title: 'sub 2' }],
    design: async () => ({ notes: 'wireframe' }),
    dev: async (s) => ({ branch: `feature/${s.title}`, title: `feat: ${s.title}` }),
    marketing: async () => ({ releaseNotes: 'notes' }),
  }
  return { adapters: { plane, design, docs }, agents }
}

test('gateForState maps pipeline states to gate names', () => {
  assert.equal(gateForState('triage'), 'roadmap')
  assert.equal(gateForState('planned'), 'plan')
  assert.equal(gateForState('in_qa'), 'merge')
  assert.equal(gateForState('done'), null)
})

test('roadmap approve → PM plans → plan gate', async () => {
  const ctx = ctxFor({ id: 'ISS-1', title: 'x', state: 'triage' })
  const r = await advanceFromGate('roadmap', ctx.adapters.plane.getIssue('ISS-1'), ctx)
  assert.equal(r.state, 'planned')
  assert.equal(r.gate, 'plan')
  assert.equal(r.issue.sub.length, 2)
})

test('plan approve on a non-UI issue → dev → merge gate', async () => {
  const ctx = ctxFor({ id: 'ISS-1', title: 'x', state: 'planned', sub: [{ title: 'sub 1' }], needsUi: false })
  const r = await advanceFromGate('plan', ctx.adapters.plane.getIssue('ISS-1'), ctx)
  assert.equal(r.state, 'in_qa')
  assert.equal(r.gate, 'merge')
  assert.equal(r.issue.mr.branch, 'feature/sub 1')
})

test('plan approve on a UI issue detours through design gate', async () => {
  const ctx = ctxFor({ id: 'ISS-1', title: 'x', state: 'planned', needsUi: true })
  const r = await advanceFromGate('plan', ctx.adapters.plane.getIssue('ISS-1'), ctx)
  assert.equal(r.state, 'designed')
  assert.equal(r.gate, 'design')
})

test('merge → prod → publish → done ladder', async () => {
  const ctx = ctxFor({ id: 'ISS-1', title: 'x', state: 'in_qa' })
  let r = await advanceFromGate('merge', ctx.adapters.plane.getIssue('ISS-1'), ctx)
  assert.equal(r.state, 'staged'); assert.equal(r.gate, 'prod')
  r = await advanceFromGate('prod', ctx.adapters.plane.getIssue('ISS-1'), ctx)
  assert.equal(r.state, 'marketed'); assert.equal(r.gate, 'publish')
  r = await advanceFromGate('publish', ctx.adapters.plane.getIssue('ISS-1'), ctx)
  assert.equal(r.state, 'published'); assert.equal(r.gate, null)
})
