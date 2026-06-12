import { FakePlane } from './plane.mjs'
import { FakeRepo } from './repo.mjs'
import { FakeCI } from './ci.mjs'
import { FakeNotify } from './notify.mjs'
import { FakeDesign } from './design.mjs'
import { FakeDocs } from './docs.mjs'
import { LocalCI } from './ci-local.mjs'
import { LocalRepo } from './repo-git.mjs'
import { createLogger } from '../obs/logger.mjs'

// Real impls (MCP-backed) land here later behind the same interface.
export function getAdapters(mode = process.env.HERMES_MODE || 'fake') {
  if (mode === 'fake') {
    return { mode, plane: new FakePlane(), repo: new FakeRepo(), ci: new FakeCI(), notify: new FakeNotify(), design: new FakeDesign(), docs: new FakeDocs(), log: createLogger() }
  }
  if (mode === 'local') {
    // credless real-dev: real CI + real local git; Plane/design/docs stay fake until creds.
    return { mode, plane: new FakePlane(), repo: new LocalRepo(), ci: new LocalCI(), notify: new FakeNotify(), log: createLogger(), design: new FakeDesign(), docs: new FakeDocs() }
  }
  throw new Error(`HERMES_MODE=${mode} not wired yet (only 'fake' and 'local' available without prod keys)`)
}
