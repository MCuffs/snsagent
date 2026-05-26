import { normalizePlan, PRICING_PLANS } from './limits-types'

const DAY_MS = 24 * 60 * 60 * 1000

export const HISTORY_EXPIRY_WARNING_DAYS = 10

export function getHistoryRetentionDays(plan: string) {
  return PRICING_PLANS[normalizePlan(plan)].historyRetentionDays
}

export function getHistoryRetentionStatus(createdAt: Date, plan: string, now = new Date()) {
  const retentionDays = getHistoryRetentionDays(plan)
  const expiresAt = new Date(createdAt.getTime() + retentionDays * DAY_MS)
  const remainingMs = expiresAt.getTime() - now.getTime()
  const isExpired = remainingMs <= 0
  const daysUntilDeletion = Math.max(0, Math.ceil(remainingMs / DAY_MS))

  return {
    retentionDays,
    expiresAt,
    daysUntilDeletion,
    isExpired,
    expiresSoon: !isExpired && daysUntilDeletion <= HISTORY_EXPIRY_WARNING_DAYS,
  }
}
