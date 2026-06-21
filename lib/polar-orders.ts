export interface PolarOrderWebhookData {
  id?: string
  created_at?: string
  modified_at?: string | null
  status?: string
  total_amount?: number
  refunded_amount?: number
  currency?: string
  subscription_id?: string | null
  checkout_id?: string | null
  metadata?: Record<string, unknown>
  customer?: {
    email?: string | null
    external_id?: string | null
  } | null
}

/** Polar represents monetary values in cents in its API and webhooks. */
export function polarCentsToMajorUnits(value?: number | null) {
  if (!Number.isFinite(value)) return 0
  return Math.round((value || 0) / 100)
}

export function paymentStatusFromPolarOrder(order: PolarOrderWebhookData) {
  const total = Math.max(0, order.total_amount || 0)
  const refunded = Math.max(0, order.refunded_amount || 0)
  if (refunded <= 0) return 'paid'
  return refunded >= total ? 'cancelled' : 'partial_refund'
}

export function polarOrderTimestamp(order: PolarOrderWebhookData, eventTimestamp?: string) {
  for (const value of [eventTimestamp, order.modified_at, order.created_at]) {
    if (!value) continue
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return new Date()
}
