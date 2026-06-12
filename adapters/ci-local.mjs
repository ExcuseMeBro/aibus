import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { workspacePath } from '../dev/workspace.mjs'

// Real CI: runs the test command in the issue's workspace; status from exit code.
export class LocalCI {
  constructor({ base = '.hermes/work', cmd = 'node --test' } = {}) {
    this.base = base
    this.cmd = cmd
  }

  runPipeline(mr) {
    const cwd = workspacePath(mr.issueId, this.base)
    if (!existsSync(cwd)) {
      return { status: 'fail', report: `no workspace for ${mr.issueId}` }
    }
    // Strip NODE_TEST_CONTEXT so node --test isn't treated as recursive
    // when LocalCI is called from inside another node --test process.
    const env = { ...process.env }
    delete env.NODE_TEST_CONTEXT
    try {
      const out = execSync(this.cmd, { cwd, encoding: 'utf8', stdio: 'pipe', env })
      return { status: 'pass', report: out.trim().split('\n').slice(-3).join('\n') }
    } catch (err) {
      const report = `${err.stdout || ''}${err.stderr || err.message}`
      return { status: 'fail', report: report.trim().split('\n').slice(-5).join('\n') }
    }
  }
}
