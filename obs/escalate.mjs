// Escalate a problem to the human: structured error log + notify.
// Accepts the adapters bag (uses notify + optional log).
export function escalate({ notify, log }, issue, reason) {
  log?.('error', { action: 'escalate', issueId: issue.id, reason })
  notify.send('human', `⚠️ ${issue.id} "${issue.title}" needs you: ${reason}`)
  return { escalated: true, issueId: issue.id, reason }
}
