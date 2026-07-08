// The gated ADLC ladder, Telegram edition. Each human gate PAUSES the issue;
// approving it runs exactly one stage (via claude agents + adapters) and lands on
// the next gate. Pure of network IO — agents + adapters are injected — so the
// whole ladder is unit-testable with fakes. Gate names match ingest/roles.mjs.
//
//   triage  --roadmap-->  PM plan        -> planned   -> gate: plan
//   planned --plan----->  design (if UI) -> designed  -> gate: design
//                         else dev        -> in_qa     -> gate: merge
//   designed--design--->  dev            -> in_qa     -> gate: merge
//   in_qa   --merge---->  stage deploy    -> staged    -> gate: prod
//   staged  --prod----->  prod + marketing-> marketed  -> gate: publish
//   marketed--publish-->  published (done)

// Which gate a state is waiting on (null = no gate / terminal).
export function gateForState(state) {
  return {
    triage: 'roadmap',
    planned: 'plan',
    designed: 'design',
    in_qa: 'merge',
    staged: 'prod',
    marketed: 'publish',
  }[state] || null
}

// A one-line human-readable summary of an issue's current pause point.
export function gateSummary(gate, issue) {
  switch (gate) {
    case 'roadmap': return `${issue.type || 'task'} · ${issue.priority || 'medium'}\n${(issue.acceptance || []).slice(0, 3).map(a => `• ${a}`).join('\n')}`
    case 'plan': return `${(issue.sub || []).length} sub-tasks:\n${(issue.sub || []).map(s => `• ${s.title}`).join('\n')}`
    case 'design': return `design: ${issue.design || 'prototype ready'}`
    case 'merge': return `MR ${issue.mr?.branch || ''} — ${issue.mr?.title || 'ready'}`
    case 'prod': return `staged & smoke-passed — deploy to prod?`
    case 'publish': return `release notes drafted — publish?`
    default: return ''
  }
}

// Run the single stage unlocked by approving `gate`. Mutates the issue in Plane
// via adapters, returns { state, gate } (gate = the NEXT pause, or null if done).
// ctx = { adapters, agents } where agents.{pm,dev,design,marketing} are async fns.
export async function advanceFromGate(gate, issue, ctx) {
  const { adapters, agents } = ctx
  const { plane } = adapters
  switch (gate) {
    case 'roadmap': {
      const sub = await agents.pm(issue)
      const up = plane.updateIssue(issue.id, { sub, state: 'planned' })
      adapters.log?.('info', { action: 'stage', issueId: issue.id, to: 'planned' })
      return { state: 'planned', gate: 'plan', issue: up }
    }
    case 'plan': {
      if (issue.needsUi && !issue.design) {
        const d = await agents.design(issue)
        const proto = adapters.design.createPrototype({ issueId: issue.id, title: issue.title, notes: d?.notes || '' })
        const up = plane.updateIssue(issue.id, { design: proto.ref, state: 'designed' })
        return { state: 'designed', gate: 'design', issue: up }
      }
      return runDev(issue, ctx)
    }
    case 'design':
      return runDev(issue, ctx)
    case 'merge': {
      // MVP: mark merged + staged. Real GitLab merge + staging deploy = roadmap.
      const up = plane.updateIssue(issue.id, { state: 'staged', merged: true })
      adapters.log?.('info', { action: 'stage', issueId: issue.id, to: 'staged' })
      return { state: 'staged', gate: 'prod', issue: up }
    }
    case 'prod': {
      const m = await agents.marketing(issue)
      const page = adapters.docs.createPage({ issueId: issue.id, title: `Release: ${issue.title}`, body: m?.releaseNotes || '' })
      const up = plane.updateIssue(issue.id, { releaseDoc: page.pageId, state: 'marketed', deployedProd: true })
      return { state: 'marketed', gate: 'publish', issue: up }
    }
    case 'publish': {
      const up = plane.updateIssue(issue.id, { state: 'published' })
      adapters.log?.('info', { action: 'stage', issueId: issue.id, to: 'published' })
      return { state: 'published', gate: null, issue: up }
    }
    default:
      return { state: issue.state, gate: gateForState(issue.state), issue }
  }
}

async function runDev(issue, ctx) {
  const { adapters, agents } = ctx
  const sub = issue.sub?.[0] || { title: issue.title }
  const mr = await agents.dev(sub) // { branch, title } — reasoning only in MVP
  const up = adapters.plane.updateIssue(issue.id, { mr, state: 'in_qa' })
  ctx.adapters.log?.('info', { action: 'stage', issueId: issue.id, to: 'in_qa', mr: mr?.branch })
  return { state: 'in_qa', gate: 'merge', issue: up }
}
