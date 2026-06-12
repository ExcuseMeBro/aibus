import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FakePlane } from '../adapters/plane.mjs'
import { FakeRepo } from '../adapters/repo.mjs'
import { FakeCI } from '../adapters/ci.mjs'
import { FakeNotify } from '../adapters/notify.mjs'
import { runToGate } from './run.mjs'

test('runToGate drives backlog issue to in_qa (auto stages)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'run-'))
  const ad = { plane: new FakePlane(join(dir, 'p.json')), repo: new FakeRepo(join(dir, 'r.json')), ci: new FakeCI(), notify: new FakeNotify(join(dir, 'n.log')) }
  const agents = { pm: async (i) => [{ title: `${i.title} - 1` }], dev: async (s) => ({ branch: 'b', title: `feat: ${s.title}` }) }
  try {
    const issue = ad.plane.createIssue({ title: 'Build X', state: 'backlog' })
    const final = await runToGate(issue.id, ad, agents)
    assert.equal(final.state, 'in_qa')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
