// Headless reasoning: run a role agent via `claude -p` (Claude Max subscription
// auth on the host) and parse its JSON answer. The agent only *reasons* — all IO
// (Plane writes, telegram) is owned by the daemon, so no MCP/tools are needed
// here. spawnFn is injectable so the whole thing is testable without spawning.

import { readFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const pexecFile = promisify(execFile)

// Drop the YAML frontmatter from an agent .md, leaving the system prompt body.
export function stripFrontmatter(md) {
  return md.replace(/^---\n[\s\S]*?\n---\n?/, '').trim()
}

// System prompt for a role = the committed `.claude/agents/<role>-agent.md` body.
export function loadRolePrompt(role, dir = '.claude/agents') {
  return stripFrontmatter(readFileSync(`${dir}/${role}-agent.md`, 'utf8'))
}

// Pull a JSON object out of a model answer: try the whole string, then a fenced
// ```json block, then the first balanced {...}. Throws if none parse.
export function extractJson(text) {
  if (text == null) throw new Error('agent returned no text')
  const s = String(text).trim()
  const tries = []
  tries.push(s)
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) tries.push(fence[1].trim())
  const first = s.indexOf('{')
  const last = s.lastIndexOf('}')
  if (first !== -1 && last > first) tries.push(s.slice(first, last + 1))
  for (const t of tries) {
    try { return JSON.parse(t) } catch { /* next */ }
  }
  throw new Error(`agent did not return parseable JSON: ${s.slice(0, 200)}`)
}

// Default spawner: `claude -p <prompt> --output-format json --append-system-prompt <sys>`.
async function defaultSpawn(args) {
  const { stdout } = await pexecFile('claude', args, { maxBuffer: 16 * 1024 * 1024 })
  return stdout
}

// Run one role agent on `input`, return the parsed JSON object it emits.
export async function runAgent(role, input, opts = {}) {
  const {
    model = process.env.HERMES_MODEL || 'sonnet',
    spawnFn = defaultSpawn,
    agentsDir = '.claude/agents',
    schemaHint = '',
  } = opts
  const sys = loadRolePrompt(role, agentsDir)
  const body = typeof input === 'string' ? input : JSON.stringify(input, null, 2)
  const user =
    `${body}\n\nRespond with ONLY a JSON object` +
    `${schemaHint ? ` matching: ${schemaHint}` : ''}. No prose, no markdown fences.`
  const args = ['-p', user, '--output-format', 'json', '--append-system-prompt', sys, '--model', model]
  const stdout = await spawnFn(args)
  let env
  try { env = JSON.parse(stdout) } catch { throw new Error(`claude ${role}: non-JSON envelope: ${String(stdout).slice(0, 200)}`) }
  if (env.is_error || env.subtype === 'error') throw new Error(`claude ${role} failed: ${env.result || env.subtype}`)
  return extractJson(env.result)
}
