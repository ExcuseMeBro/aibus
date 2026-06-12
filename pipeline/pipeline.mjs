import { escalate } from '../obs/escalate.mjs'

// One transition of an issue through the ADLC, using adapters + agent fns.
// Pure orchestration: all side effects go through adapters; agents are injected.
export async function advance(issue, adapters, agents) {
  const { plane, repo, ci } = adapters
  switch (issue.state) {
    case 'backlog': {
      const sub = await agents.pm(issue)
      plane.updateIssue(issue.id, { sub, state: 'planned' })
      adapters.log?.('info', { action: 'transition', issueId: issue.id, from: 'backlog', to: 'planned' })
      return { stage: 'planned', sub }
    }
    case 'planned': {
      // MVP: drive the first sub-task to an MR. Multi-sub fan-out is a later slice.
      const sub = issue.sub?.[0] || { title: issue.title }
      const { branch, title } = await agents.dev(sub)
      const mr = repo.openMR({ title, branch, issueId: issue.id })
      const result = await ci.runPipeline(mr) // await: real CI adapters are async
      if (result.status === 'pass') {
        plane.updateIssue(issue.id, { state: 'in_qa', mrId: mr.id })
        adapters.log?.('info', { action: 'transition', issueId: issue.id, from: 'planned', to: 'in_qa', mrId: mr.id })
        return { stage: 'in_qa', mrId: mr.id, ci: result }
      }
      escalate(adapters, issue, `CI failed (${mr.id}): ${result.report}`)
      plane.updateIssue(issue.id, { state: 'in_dev', mrId: mr.id })
      return { stage: 'in_dev', mrId: mr.id, ci: result, escalated: true }
    }
    default:
      return { stage: issue.state, noop: true }
  }
}
