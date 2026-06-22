import assert from 'node:assert/strict'
import test from 'node:test'
import {
  paymentStatusFromPolarOrder,
  polarCentsToMajorUnits,
  polarOrderTimestamp,
} from '../lib/polar-orders.ts'

test('Polar cent amounts are converted to stored major currency units', () => {
  assert.equal(polarCentsToMajorUnits(2_500_000), 25_000)
  assert.equal(polarCentsToMajorUnits(3_900_000), 39_000)
  assert.equal(polarCentsToMajorUnits(undefined), 0)
})

test('Polar refund status distinguishes partial and full refunds', () => {
  assert.equal(paymentStatusFromPolarOrder({ total_amount: 2_500_000, refunded_amount: 0 }), 'paid')
  assert.equal(paymentStatusFromPolarOrder({ total_amount: 2_500_000, refunded_amount: 500_000 }), 'partial_refund')
  assert.equal(paymentStatusFromPolarOrder({ total_amount: 2_500_000, refunded_amount: 2_500_000 }), 'cancelled')
})

test('Polar event timestamp has priority over order timestamps', () => {
  const value = polarOrderTimestamp(
    { created_at: '2026-01-01T00:00:00.000Z' },
    '2026-01-02T00:00:00.000Z',
  )
  assert.equal(value.toISOString(), '2026-01-02T00:00:00.000Z')
})
