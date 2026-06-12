import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FakeCI } from './ci.mjs'

test('runPipeline passes by default', () => {
  const ci = new FakeCI()
  const r = ci.runPipeline({ title: 'feat: add x' })
  assert.equal(r.status, 'pass')
})
test('runPipeline fails when title flags fail', () => {
  const ci = new FakeCI()
  const r = ci.runPipeline({ title: 'broken [ci-fail]' })
  assert.equal(r.status, 'fail')
  assert.ok(r.report)
})
