import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prepWorkspace } from '../dev/workspace.mjs'
import { LocalCI } from './ci-local.mjs'

function tempBase() {
  return mkdtempSync(join(tmpdir(), 'hermes-ci-'))
}

test('runPipeline returns pass when real tests pass', () => {
  const base = tempBase()
  try {
    const wsPath = prepWorkspace('ISS-1', base)

    // Write a passing module and test
    writeFileSync(join(wsPath, 'sum.mjs'), 'export const sum = (a, b) => a + b\n')
    writeFileSync(join(wsPath, 'sum.test.mjs'), [
      "import { test } from 'node:test'",
      "import assert from 'node:assert/strict'",
      "import { sum } from './sum.mjs'",
      "test('sum adds two numbers', () => { assert.equal(sum(2, 2), 4) })",
    ].join('\n') + '\n')

    const ci = new LocalCI({ base })
    const result = ci.runPipeline({ issueId: 'ISS-1' })
    assert.equal(result.status, 'pass', `expected pass, got ${result.status}. report: ${result.report}`)
    assert.ok(result.report, 'report should be non-empty')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('runPipeline returns fail when real tests fail', () => {
  const base = tempBase()
  try {
    const wsPath = prepWorkspace('ISS-2', base)

    // Write a test that asserts something false
    writeFileSync(join(wsPath, 'broken.test.mjs'), [
      "import { test } from 'node:test'",
      "import assert from 'node:assert/strict'",
      "test('always fails', () => { assert.equal(1, 2, 'forced failure') })",
    ].join('\n') + '\n')

    const ci = new LocalCI({ base })
    const result = ci.runPipeline({ issueId: 'ISS-2' })
    assert.equal(result.status, 'fail', `expected fail, got ${result.status}`)
    assert.ok(result.report, 'report should be non-empty')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('runPipeline returns fail when workspace does not exist', () => {
  const base = tempBase()
  try {
    const ci = new LocalCI({ base })
    const result = ci.runPipeline({ issueId: 'ISS-NONE' })
    assert.equal(result.status, 'fail')
    assert.ok(result.report.includes('ISS-NONE'), `report should mention the issue id: ${result.report}`)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})
