import { normalizePlan } from './limits-types'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

export function getCampaignUsagePeriodStart(planValue: string, now = new Date()) {
  const plan = normalizePlan(planValue)
  const inKorea = new Date(now.getTime() + KST_OFFSET_MS)

  if (plan === 'FREE') {
    inKorea.setUTCHours(0, 0, 0, 0)
  } else {
    inKorea.setUTCDate(1)
    inKorea.setUTCHours(0, 0, 0, 0)
  }

  return new Date(inKorea.getTime() - KST_OFFSET_MS)
}
