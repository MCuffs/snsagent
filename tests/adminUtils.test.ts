import assert from 'node:assert/strict'
import test from 'node:test'
import { dateRange, parseAdminPage, parseAdminPageSize } from '../app/admin/_components/adminUtils.ts'

test('admin pagination values are constrained to supported ranges', () => {
  assert.equal(parseAdminPage('3'), 3)
  assert.equal(parseAdminPage('-1'), 1)
  assert.equal(parseAdminPage('invalid'), 1)
  assert.equal(parseAdminPageSize('25'), 25)
  assert.equal(parseAdminPageSize('100'), 100)
  assert.equal(parseAdminPageSize('500'), 50)
})

test('admin date range uses Korean day boundaries and rejects invalid dates', () => {
  const range = dateRange('2026-06-01', '2026-06-30')
  assert.equal(range?.gte?.toISOString(), '2026-05-31T15:00:00.000Z')
  assert.equal(range?.lte?.toISOString(), '2026-06-30T14:59:59.999Z')
  assert.equal(dateRange('invalid', 'also-invalid'), undefined)
})
