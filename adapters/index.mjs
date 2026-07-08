import { FakePlane } from './plane.mjs'
import { FakeRepo } from './repo.mjs'
import { FakeCI } from './ci.mjs'
import { FakeNotify } from './notify.mjs'
import { FakeDesign } from './design.mjs'
import { FakeDocs } from './docs.mjs'
import { LocalCI } from './ci-local.mjs'
import { LocalRepo } from './repo-git.mjs'
import { RealPlane } from './plane-real.mjs'
import { TelegramNotify } from './notify-telegram.mjs'
import { createLogger } from '../obs/logger.mjs'

// fake  = fully in-memory (offline e2e).
// local = credless real-dev: real local git + real test exec; Plane stays fake.
// real  = production: Plane over REST + telegram notify; dev still runs on the
//         local git/CI seam until GitLab remote push is wired (see roadmap).
export function getAdapters(mode = process.env.HERMES_MODE || 'fake') {
  if (mode === 'fake') {
    return { mode, plane: new FakePlane(), repo: new FakeRepo(), ci: new FakeCI(), notify: new FakeNotify(), design: new FakeDesign(), docs: new FakeDocs(), log: createLogger() }
  }
  if (mode === 'local') {
    return { mode, plane: new FakePlane(), repo: new LocalRepo(), ci: new LocalCI(), notify: new FakeNotify(), log: createLogger(), design: new FakeDesign(), docs: new FakeDocs() }
  }
  if (mode === 'real') {
    return { mode, plane: new RealPlane(), repo: new LocalRepo(), ci: new LocalCI(), notify: new TelegramNotify(), log: createLogger(), design: new FakeDesign(), docs: new FakeDocs() }
  }
  throw new Error(`HERMES_MODE=${mode} not wired yet (fake | local | real)`)
}
