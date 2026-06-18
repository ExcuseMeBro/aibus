// Human role authorization for telegram gates.
// A telegram user_id maps to ONE role; each gate may be approved only by its
// owning role (admin bypasses all). Fail-closed: unknown user/gate → denied.
// Config source: env HERMES_ROLES = JSON `{"<user_id>":"<role>", ...}`.

// Which human role may approve each pipeline gate (see ARCHITECTURE §3).
export const GATE_ROLE = {
  roadmap: 'po', // GATE 1 — add to roadmap
  plan: 'pm', // GATE 2 — plan approved
  design: 'design', // GATE 3 — design approved
  merge: 'reviewer', // GATE 5 — MR merge (most important)
  prod: 'devops', // GATE 6 — prod deploy
  publish: 'marketing', // GATE 7 — publish
}

// Parse the HERMES_ROLES env value into a { userId(string) → role } map.
// Any malformed/missing input yields an empty map (no one authorized).
export function parseRoles(raw) {
  if (!raw || typeof raw !== 'string') return {}
  try {
    const obj = JSON.parse(raw)
    if (!obj || typeof obj !== 'object') return {}
    const map = {}
    for (const [id, role] of Object.entries(obj)) {
      if (typeof role === 'string' && role) map[String(id)] = role
    }
    return map
  } catch {
    return {}
  }
}

// Role of a telegram user (number or string id), or null if unmapped.
export function roleOf(map, userId) {
  if (!map || userId == null) return null
  return map[String(userId)] ?? null
}

// May this user approve this gate? admin bypasses; otherwise role must own the gate.
export function canApprove(map, userId, gate) {
  const role = roleOf(map, userId)
  if (!role) return false
  if (role === 'admin') return true
  const required = GATE_ROLE[gate]
  if (!required) return false // unknown gate → fail closed
  return role === required
}
