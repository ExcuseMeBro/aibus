import { advance } from './pipeline.mjs'

// Drive an issue through automatic stages until it reaches a state that needs
// a human gate (in_qa = merge gate, staged = done) or stops progressing.
const GATE_STATES = new Set(['in_qa', 'ready_to_merge', 'staged', 'in_dev'])

export async function runToGate(issueId, adapters, agents, maxSteps = 10) {
  for (let i = 0; i < maxSteps; i++) {
    const issue = adapters.plane.getIssue(issueId)
    if (!issue) throw new Error(`no issue ${issueId}`)
    if (GATE_STATES.has(issue.state)) return issue
    const before = issue.state
    await advance(issue, adapters, agents)
    const after = adapters.plane.getIssue(issueId).state
    if (after === before) return adapters.plane.getIssue(issueId) // no progress
  }
  return adapters.plane.getIssue(issueId)
}

// CLI demo: HERMES_MODE=fake node pipeline/run.mjs <issueId>
if (import.meta.url === `file://${process.argv[1]}`) {
  const { getAdapters } = await import('../adapters/index.mjs')
  const ad = getAdapters()
  const agents = {
    pm: async (i) => [{ title: `${i.title} - 1` }],
    dev: async (s) => ({ branch: `feature/${s.title}`.replace(/\s+/g, '-'), title: `feat: ${s.title}` }),
  }
  const id = process.argv[2]
  const out = await runToGate(id, ad, agents)
  process.stdout.write(JSON.stringify(out, null, 2))
}
