import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkRoleOutput, assertRoleOutput, KEY_OWNER, ROLES } from './guard.mjs'

// Each role's own legitimate output passes clean.
test('legitimate role outputs pass', () => {
  assert.equal(checkRoleOutput('po', { action: 'created', issue_id: 'ISS-1', type: 'bug', priority: 'P1', title: 'x' }).ok, true)
  assert.equal(checkRoleOutput('pm', { sub: [{ title: 't' }] }).ok, true)
  assert.equal(checkRoleOutput('design', { prototypeRef: 'fig://1', notes: 'n' }).ok, true)
  assert.equal(checkRoleOutput('dev', { branch: 'feature/x', title: 'feat: x', files: ['a'] }).ok, true)
  assert.equal(checkRoleOutput('qa', { verdict: 'pass', findings: [] }).ok, true)
  assert.equal(checkRoleOutput('devops', { staged: true, url: 'http://s' }).ok, true)
  assert.equal(checkRoleOutput('marketing', { releaseNotes: 'r', launchPost: 'p' }).ok, true)
})

// A role returning another role's artifact is a boundary breach.
test('PO returning PM sub-tasks is a violation', () => {
  const r = checkRoleOutput('po', { action: 'created', issue_id: 'ISS-1', sub: [{ title: 't' }] })
  assert.equal(r.ok, false)
  assert.equal(r.violations[0].key, 'sub')
  assert.equal(r.violations[0].owner, 'pm')
})

test('dev returning a merge is a gate breach', () => {
  const r = checkRoleOutput('dev', { branch: 'feature/x', merged: true })
  assert.equal(r.ok, false)
  assert.equal(r.violations[0].owner, 'human-gate:merge')
})

test('devops returning a prod deploy is a gate breach', () => {
  const r = checkRoleOutput('devops', { staged: true, prod: true })
  assert.equal(r.ok, false)
  assert.equal(r.violations[0].key, 'prod')
})

test('QA cannot merge', () => {
  assert.equal(checkRoleOutput('qa', { verdict: 'pass', merged: true }).ok, false)
})

test('marketing cannot publish itself', () => {
  assert.equal(checkRoleOutput('marketing', { releaseNotes: 'r', published: true }).ok, false)
})

// Unknown role is a programming error, not a soft violation.
test('unknown role throws', () => {
  assert.throws(() => checkRoleOutput('wizard', {}), /unknown role/)
})

// Falsy / non-object output is treated as clean (agent returned nothing to leak).
test('null output is ok', () => {
  assert.equal(checkRoleOutput('pm', null).ok, true)
})

// assertRoleOutput throws on breach, returns the output on pass.
test('assertRoleOutput throws with the offending keys', () => {
  assert.throws(
    () => assertRoleOutput('po', { issue_id: 'i', verdict: 'pass' }),
    /guard.*po.*verdict/i,
  )
  const good = { sub: [] }
  assert.equal(assertRoleOutput('pm', good), good)
})

// Sanity: the role list and ownership map are exported and consistent.
test('ROLES and KEY_OWNER exported', () => {
  assert.ok(ROLES.includes('po') && ROLES.includes('devops'))
  assert.equal(KEY_OWNER.sub, 'pm')
  assert.equal(KEY_OWNER.merged, 'human-gate:merge')
})
