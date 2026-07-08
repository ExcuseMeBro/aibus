// Pure routing: turn one raw telegram update into a typed intent the daemon can
// act on. No IO — reuses ingest/telegram.mjs (message filter) and ingest/gate.mjs
// (callback parse+authz). Kept pure so the daemon's dispatch is unit-testable.

import { filter, toSignal } from '../ingest/telegram.mjs'
import { decide } from '../ingest/gate.mjs'

// classify(update, rolesMap, botUsername) -> one of:
//   { kind: 'signal', signal }                     a fresh task message
//   { kind: 'gate', ...decision }                  an (authorized-or-not) button press
//   { kind: 'ignore', reason }                     noise / other bot / non-task
export function classify(update, rolesMap, botUsername) {
  if (update?.callback_query) {
    const d = decide(rolesMap, update)
    if (!d.ok) return { kind: 'ignore', reason: d.reason }
    return { kind: 'gate', ...d }
  }
  const msg = update?.message
  if (msg && filter(msg, botUsername)) {
    const signal = toSignal(msg, botUsername)
    if (signal.text) return { kind: 'signal', signal }
    return { kind: 'ignore', reason: 'empty signal text' }
  }
  return { kind: 'ignore', reason: 'not a task message or gate' }
}

// Largest update_id + 1, or null if the batch was empty — for offset advance.
export function nextOffset(updates) {
  let max = -1
  for (const u of updates) if (typeof u.update_id === 'number') max = Math.max(max, u.update_id)
  return max >= 0 ? max + 1 : null
}
