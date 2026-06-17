// Role-boundary guard. Each ADLC role owns a narrow set of output artifacts;
// returning a key owned by ANOTHER role (or by a human gate) is a boundary breach.
// This is the runtime half of the per-role guard contracts in .claude/agents/*.md.

// Every guarded artifact key → the single role (or human gate) allowed to emit it.
// A key absent here is shared/benign (e.g. `title`, `reason`, `notes`, `url`) — never a breach.
export const KEY_OWNER = {
  // PO owns issue creation
  action: 'po',
  issue_id: 'po',
  // PM owns the breakdown
  sub: 'pm',
  // Design owns the prototype
  prototypeRef: 'design',
  // Dev owns the branch/code (local, credless)
  branch: 'dev',
  files: 'dev',
  blocked: 'dev',
  // QA owns the verdict
  verdict: 'qa',
  findings: 'qa',
  // DevOps owns staging only
  staged: 'devops',
  // Marketing owns the copy
  releaseNotes: 'marketing',
  launchPost: 'marketing',
  // Human-only gates — NO agent may ever emit these
  merged: 'human-gate:merge',
  prod: 'human-gate:prod',
  deployedProd: 'human-gate:prod',
  published: 'human-gate:publish',
}

export const ROLES = ['po', 'pm', 'design', 'dev', 'qa', 'devops', 'marketing']

// Inspect one role's returned object for keys it is not allowed to emit.
// Returns { ok, role, violations: [{ key, owner }] }. Throws only on an unknown role.
export function checkRoleOutput(role, output) {
  if (!ROLES.includes(role)) throw new Error(`guard: unknown role "${role}"`)
  if (!output || typeof output !== 'object') return { ok: true, role, violations: [] }

  const violations = []
  for (const key of Object.keys(output)) {
    const owner = KEY_OWNER[key]
    if (owner && owner !== role) violations.push({ key, owner })
  }
  return { ok: violations.length === 0, role, violations }
}

// Enforcing variant for the pipeline: throw on breach, otherwise pass the output through.
export function assertRoleOutput(role, output) {
  const { ok, violations } = checkRoleOutput(role, output)
  if (!ok) {
    const detail = violations.map((v) => `${v.key}→${v.owner}`).join(', ')
    throw new Error(`guard: role "${role}" crossed a boundary: ${detail}`)
  }
  return output
}
