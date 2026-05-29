import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSessionUser, getCachedBrands } from '../../../../lib/auth/user'
import { dbService } from '../../../../lib/db-service'
import { getHistoryRetentionStatus } from '../../../../lib/history-retention'
import { normalizePlan, PRICING_PLANS } from '../../../../lib/limits-types'
import DashboardContainer from '../../../(cms)/concept/DashboardContainer'
import { Loader2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

function DashboardFallback() {
  return (
    <div className="flex h-full items-center justify-center p-12">
      <Loader2 className="h-8 w-8 animate-spin text-[#71717a]" />
    </div>
  )
}

export default function ConceptPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardDataLoader />
    </Suspense>
  )
}

async function DashboardDataLoader() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const plan = normalizePlan(user.plan || 'FREE')
  await dbService.deleteExpiredCampaignsForUser(user.id, plan)

  const [brands, campaigns] = await Promise.all([
    getCachedBrands(user.id),
    dbService.getCampaignSummaries(user.id),
  ])

  const existingBrand = brands[0] || null

  const serializedBrand = existingBrand
    ? {
        id: existingBrand.id,
        name: existingBrand.name,
        industry: existingBrand.industry,
        targetAudience: existingBrand.targetAudience,
        toneOfVoice: existingBrand.toneOfVoice,
        mainColor: existingBrand.mainColor,
        forbiddenWords: existingBrand.forbiddenWords,
        ctaStyle: existingBrand.ctaStyle,
        brandDna: existingBrand.brandDna,
        websiteUrl: existingBrand.websiteUrl,
      }
    : null

  const serializedCampaigns = campaigns.map((campaign) => {
    const retention = getHistoryRetentionStatus(campaign.createdAt, plan)
    return {
      id: campaign.id,
      title: campaign.title,
      status: campaign.status,
      createdAt: campaign.createdAt.toISOString(),
      thumbnail: campaign.thumbnail,
      expiresAt: retention.expiresAt.toISOString(),
      daysUntilDeletion: retention.daysUntilDeletion,
      expiresSoon: retention.expiresSoon,
    }
  })

  return (
    <DashboardContainer
      existingBrand={serializedBrand}
      campaigns={serializedCampaigns}
      planName={PRICING_PLANS[plan].name}
      retentionDays={PRICING_PLANS[plan].historyRetentionDays}
      canUpgradeRetention={plan !== 'UNLIMITED'}
    />
  )
}
