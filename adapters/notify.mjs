import { appendFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'

export class FakeNotify {
  constructor(path = '.hermes/fake/notify.log') { this.path = path }
  send(to, text) {
    const dir = dirname(this.path)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    appendFileSync(this.path, `${new Date().toISOString()} → ${to}: ${text}\n`)
    return true
  }
}
