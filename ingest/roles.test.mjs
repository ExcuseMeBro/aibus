import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRoles, roleOf, canApprove, GATE_ROLE } from './roles.mjs'

test('parseRoles: valid JSON env → map', () => {
  const m = parseRoles('{"111":"pm","222":"devops"}')
  assert.equal(roleOf(m, 111), 'pm')
  assert.equal(roleOf(m, '222'), 'devops')
})

test('parseRoles: missing/invalid → empty map (fail closed)', () => {
  assert.deepEqual(roleOf(parseRoles(undefined), 1), null)
  assert.deepEqual(roleOf(parseRoles('not json'), 1), null)
  assert.deepEqual(roleOf(parseRoles(''), 1), null)
})

test('roleOf: numeric and string id normalize the same', () => {
  const m = parseRoles('{"7":"qa"}')
  assert.equal(roleOf(m, 7), 'qa')
  assert.equal(roleOf(m, '7'), 'qa')
  assert.equal(roleOf(m, 8), null)
})

test('GATE_ROLE maps each gate to the role allowed to approve it', () => {
  assert.equal(GATE_ROLE.plan, 'pm')
  assert.equal(GATE_ROLE.merge, 'reviewer')
  assert.equal(GATE_ROLE.prod, 'devops')
  assert.equal(GATE_ROLE.publish, 'marketing')
})

test('canApprove: only the gate-owning role may approve', () => {
  const m = parseRoles('{"111":"pm","222":"devops","333":"reviewer"}')
  assert.equal(canApprove(m, 111, 'plan'), true)
  assert.equal(canApprove(m, 111, 'merge'), false) // PM cannot approve a merge
  assert.equal(canApprove(m, 333, 'merge'), true)
  assert.equal(canApprove(m, 222, 'prod'), true)
})

test('canApprove: admin bypasses every gate', () => {
  const m = parseRoles('{"999":"admin"}')
  assert.equal(canApprove(m, 999, 'plan'), true)
  assert.equal(canApprove(m, 999, 'prod'), true)
  assert.equal(canApprove(m, 999, 'publish'), true)
})

test('canApprove: unknown user or unknown gate → false (fail closed)', () => {
  const m = parseRoles('{"111":"pm"}')
  assert.equal(canApprove(m, 500, 'plan'), false) // no role
  assert.equal(canApprove(m, 111, 'wat'), false) // unknown gate
})
