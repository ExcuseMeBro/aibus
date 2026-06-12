// One transition of an issue through the ADLC, using adapters + agent fns.
// Pure orchestration: all side effects go through adapters; agents are injected.
export async function advance(issue, adapters, agents) {
  const { plane, repo, ci, notify } = adapters
  switch (issue.state) {
    case 'backlog': {
      const sub = await agents.pm(issue)
      plane.updateIssue(issue.id, { sub, state: 'planned' })
      return { stage: 'planned', sub }
    }
    case 'planned': {
      const sub = issue.sub?.[0] || { title: issue.title }
      const { branch, title } = await agents.dev(sub)
      const mr = repo.openMR({ title, branch, issueId: issue.id })
      const result = ci.runPipeline(mr)
      if (result.status === 'pass') {
        plane.updateIssue(issue.id, { state: 'in_qa', mrId: mr.id })
        return { stage: 'in_qa', mrId: mr.id, ci: result }
      }
      notify.send('human', `CI failed for ${issue.id} (${mr.id}): ${result.report}`)
      plane.updateIssue(issue.id, { state: 'in_dev', mrId: mr.id })
      return { stage: 'in_dev', mrId: mr.id, ci: result, escalated: true }
    }
    default:
      return { stage: issue.state, noop: true }
  }
}
