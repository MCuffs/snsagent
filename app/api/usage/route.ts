import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../lib/auth/user'
import { dbService } from '../../../lib/db-service'
import { PRICING_PLANS, normalizePlan } from '../../../lib/limits-types'
import { getCampaignUsagePeriodStart } from '../../../lib/usage-period'
import { isAdminEmail } from '../../../lib/auth/admin-emails'

export const runtime = 'nodejs'

function isSuperUser(email?: string | null) {
  return isAdminEmail(email) || email?.toLowerCase() === 'test@test.com'
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const plan = normalizePlan(user.plan || 'FREE')
  const planFeatures = PRICING_PLANS[plan]
  const superUser = isSuperUser(user.email)

  const campaigns = await dbService.getCampaigns(user.id)

  const periodStart = plan === 'FREE' ? new Date(0) : getCampaignUsagePeriodStart(plan)

  const periodCampaigns = plan === 'FREE'
    ? campaigns
    : campaigns.filter(c => new Date(c.createdAt).getTime() >= periodStart.getTime())

  const imageCampaigns = periodCampaigns.filter(
    c => !(c as { mediaType?: string }).mediaType || (c as { mediaType?: string }).mediaType !== 'video',
  )
  const videoCampaigns = periodCampaigns.filter(
    c => (c as { mediaType?: string }).mediaType === 'video',
  )

  const imageLimit = superUser ? 999999 : planFeatures.monthlyCardLimit
  const videoLimit = superUser ? 999999 : planFeatures.monthlyVideoCardLimit

  // Build usage history (recent 30 items)
  const history = campaigns
    .slice(0, 30)
    .map(c => ({
      id: c.id,
      title: c.title,
      mediaType: (c as { mediaType?: string }).mediaType === 'video' ? 'video' : 'image',
      createdAt: c.createdAt.toISOString(),
      status: c.status,
    }))

  return NextResponse.json({
    plan,
    period: plan === 'FREE' ? 'lifetime' : 'month',
    image: {
      used: imageCampaigns.length,
      limit: imageLimit,
    },
    video: {
      used: videoCampaigns.length,
      limit: videoLimit,
    },
    history,
  })
}
