import { FakePlane } from './plane.mjs'
import { FakeRepo } from './repo.mjs'
import { FakeCI } from './ci.mjs'
import { FakeNotify } from './notify.mjs'
import { FakeDesign } from './design.mjs'
import { FakeDocs } from './docs.mjs'
import { createLogger } from '../obs/logger.mjs'

// Real impls (MCP-backed) land here later behind the same interface.
export function getAdapters(mode = process.env.HERMES_MODE || 'fake') {
  if (mode === 'fake') {
    return { mode, plane: new FakePlane(), repo: new FakeRepo(), ci: new FakeCI(), notify: new FakeNotify(), design: new FakeDesign(), docs: new FakeDocs(), log: createLogger() }
  }
  throw new Error(`HERMES_MODE=${mode} not wired yet (only 'fake' available without prod keys)`)
}
