import { FakePlane } from './plane.mjs'
import { FakeRepo } from './repo.mjs'
import { FakeCI } from './ci.mjs'
import { FakeNotify } from './notify.mjs'

// Real impls (MCP-backed) land here later behind the same interface.
export function getAdapters(mode = process.env.HERMES_MODE || 'fake') {
  if (mode === 'fake') {
    return { mode, plane: new FakePlane(), repo: new FakeRepo(), ci: new FakeCI(), notify: new FakeNotify() }
  }
  throw new Error(`HERMES_MODE=${mode} not wired yet (only 'fake' available without prod keys)`)
}
