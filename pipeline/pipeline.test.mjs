import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FakePlane } from '../adapters/plane.mjs'
import { FakeRepo } from '../adapters/repo.mjs'
import { FakeCI } from '../adapters/ci.mjs'
import { FakeNotify } from '../adapters/notify.mjs'
import { advance } from './pipeline.mjs'

function ctx() {
  const dir = mkdtempSync(join(tmpdir(), 'pipe-'))
  const ad = { plane: new FakePlane(join(dir, 'p.json')), repo: new FakeRepo(join(dir, 'r.json')), ci: new FakeCI(), notify: new FakeNotify(join(dir, 'n.log')) }
  const agents = {
    pm: async (issue) => [{ title: `${issue.title} - part 1` }],
    dev: async (sub) => ({ branch: 'feature/x', title: `feat: ${sub.title}` }),
  }
  return { ad, agents, dir }
}

test('planned: PM creates sub-issues, issue → planned', async () => {
  const { ad, agents, dir } = ctx()
  try {
    const issue = ad.plane.createIssue({ title: 'Build login', state: 'backlog' })
    const out = await advance(issue, ad, agents)
    const updated = ad.plane.getIssue(issue.id)
    assert.equal(updated.state, 'planned')
    assert.equal(updated.sub.length, 1)
    assert.equal(out.stage, 'planned')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('in_dev: dev opens MR, issue → in_qa after CI pass', async () => {
  const { ad, agents, dir } = ctx()
  try {
    const issue = ad.plane.createIssue({ title: 'Build login', state: 'planned' })
    ad.plane.updateIssue(issue.id, { sub: [{ title: 'part 1' }] })
    const out = await advance(ad.plane.getIssue(issue.id), ad, agents)
    assert.equal(out.stage, 'in_qa')
    assert.ok(out.mrId)
    assert.equal(out.ci.status, 'pass')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('in_qa CI fail → escalated, stays in_dev', async () => {
  const { ad, agents, dir } = ctx()
  const failAgents = { ...agents, dev: async () => ({ branch: 'b', title: 'broken [ci-fail]' }) }
  try {
    const issue = ad.plane.createIssue({ title: 'X', state: 'planned', sub: [{ title: 'p' }] })
    const out = await advance(ad.plane.getIssue(issue.id), ad, failAgents)
    assert.equal(out.stage, 'in_dev')
    assert.equal(out.escalated, true)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
