import { escalate } from '../obs/escalate.mjs'

// Dev → MR → CI, shared by the no-UI path and the post-design path.
async function runDev(issue, adapters, agents) {
  const { plane, repo, ci } = adapters
  const sub = issue.sub?.[0] || { title: issue.title }
  const { branch, title } = await agents.dev(sub)
  const mr = repo.openMR({ title, branch, issueId: issue.id })
  const result = await ci.runPipeline(mr)
  if (result.status === 'pass') {
    plane.updateIssue(issue.id, { state: 'in_qa', mrId: mr.id })
    adapters.log?.('info', { action: 'transition', issueId: issue.id, from: issue.state, to: 'in_qa', mrId: mr.id })
    return { stage: 'in_qa', mrId: mr.id, ci: result }
  }
  escalate(adapters, issue, `CI failed (${mr.id}): ${result.report}`)
  plane.updateIssue(issue.id, { state: 'in_dev', mrId: mr.id })
  return { stage: 'in_dev', mrId: mr.id, ci: result, escalated: true }
}

// One transition of an issue through the ADLC, using adapters + agent fns.
export async function advance(issue, adapters, agents) {
  const { plane, design, docs } = adapters
  switch (issue.state) {
    case 'backlog': {
      const sub = await agents.pm(issue)
      plane.updateIssue(issue.id, { sub, state: 'planned' })
      adapters.log?.('info', { action: 'transition', issueId: issue.id, from: 'backlog', to: 'planned' })
      return { stage: 'planned', sub }
    }
    case 'planned': {
      // UI issues detour through design (human gate) before dev.
      if (issue.needsUi && !issue.design) {
        const d = await agents.design(issue)
        const proto = design.createPrototype({ issueId: issue.id, title: issue.title, notes: d?.notes || '' })
        plane.updateIssue(issue.id, { design: proto.ref, state: 'designed' })
        adapters.log?.('info', { action: 'transition', issueId: issue.id, from: 'planned', to: 'designed', design: proto.ref })
        return { stage: 'designed', design: proto.ref }
      }
      return runDev(issue, adapters, agents)
    }
    case 'designed':
      return runDev(issue, adapters, agents)
    case 'staged': {
      // Post-ship: marketing drafts release notes (publish is a separate human gate).
      const m = await agents.marketing(issue)
      const page = docs.createPage({ issueId: issue.id, title: `Release: ${issue.title}`, body: m?.releaseNotes || '' })
      plane.updateIssue(issue.id, { releaseDoc: page.pageId, state: 'marketed' })
      adapters.log?.('info', { action: 'transition', issueId: issue.id, from: 'staged', to: 'marketed', doc: page.pageId })
      return { stage: 'marketed', doc: page.pageId }
    }
    default:
      return { stage: issue.state, noop: true }
  }
}
