import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stripFrontmatter, extractJson, runAgent } from './claude-agent.mjs'

test('stripFrontmatter removes YAML block', () => {
  const md = '---\nname: po\n---\nYou are PO.\nDo triage.'
  assert.equal(stripFrontmatter(md), 'You are PO.\nDo triage.')
})

test('stripFrontmatter is a no-op without frontmatter', () => {
  assert.equal(stripFrontmatter('just a prompt'), 'just a prompt')
})

test('extractJson parses a bare object', () => {
  assert.deepEqual(extractJson('{"a":1}'), { a: 1 })
})

test('extractJson digs JSON out of a fenced block with prose', () => {
  const s = 'Here you go:\n```json\n{"type":"bug"}\n```\ndone'
  assert.deepEqual(extractJson(s), { type: 'bug' })
})

test('extractJson falls back to first balanced braces', () => {
  assert.deepEqual(extractJson('noise {"x":true} tail'), { x: true })
})

test('extractJson parses a top-level array', () => {
  assert.deepEqual(extractJson('[{"title":"a"}]'), [{ title: 'a' }])
})

test('extractJson throws on non-JSON', () => {
  assert.throws(() => extractJson('totally not json'), /parseable JSON/)
})

test('runAgent parses the claude -p envelope .result', async () => {
  const spawnFn = async (args) => {
    assert.ok(args.includes('--output-format') && args.includes('json'))
    assert.ok(args.includes('--append-system-prompt'))
    return JSON.stringify({ is_error: false, result: '{"type":"bug","priority":"high"}' })
  }
  const out = await runAgent('po', 'crash on empty pw', { spawnFn, agentsDir: '.claude/agents' })
  assert.deepEqual(out, { type: 'bug', priority: 'high' })
})

test('runAgent throws when the envelope is an error', async () => {
  const spawnFn = async () => JSON.stringify({ is_error: true, result: 'rate limited' })
  await assert.rejects(runAgent('po', 'x', { spawnFn }), /claude po failed/)
})
