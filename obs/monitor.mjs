// Pure: find issues stuck in a non-terminal stage longer than maxAgeMs.
// `now` is injected (epoch ms) so this is deterministic and testable.
const TERMINAL = new Set(['staged', 'merged'])

export function findStuck(issues, { maxAgeMs, now }) {
  return issues.filter(i => {
    if (TERMINAL.has(i.state)) return false
    return (now - Date.parse(i.ts)) > maxAgeMs
  })
}
