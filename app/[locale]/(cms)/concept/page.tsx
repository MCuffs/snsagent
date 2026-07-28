import { Suspense } from 'react'
import { getSessionUser, getCachedBrands } from '../../../../lib/auth/user'
import { dbService } from '../../../../lib/db-service'
import { getHistoryRetentionStatus } from '../../../../lib/history-retention'
import { normalizePlan, PRICING_PLANS } from '../../../../lib/limits-types'
import DashboardContainer from '../../../(cms)/concept/DashboardContainer'
import { Loader2 } from 'lucide-react'
import { isAdminEmail } from '../../../../lib/auth/admin-emails'
import { canAccessShortsLab } from '../../../../lib/auth/shorts-lab-access'
import { getShortsLabAccess } from '../../../../lib/shorts-lab-usage'

export const dynamic = 'force-dynamic'

function DashboardFallback() {
  return (
    <div className="flex h-full items-center justify-center p-12">
      <Loader2 className="h-8 w-8 animate-spin text-[#71717a]" />
    </div>
  )
}

export default async function ConceptPage({ params: _params }: { params: Promise<{ locale: string }> }) {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardDataLoader />
    </Suspense>
  )
}

async function DashboardDataLoader() {
  const user = await getSessionUser()

  if (!user) {
    return (
      <DashboardContainer
        existingBrand={null}
        existingGeneralProfile={null}
        campaigns={[]}
        planName={PRICING_PLANS['FREE'].name}
        retentionDays={PRICING_PLANS['FREE'].historyRetentionDays}
        canUpgradeRetention={true}
        userEmail={null}
        userId={undefined}
        userName={null}
        summarizedPreference={null}
        isGuest={true}
        userPlan={null}
        canAccessShortsLab={false}
      />
    )
  }

  const plan = normalizePlan(user.plan || 'FREE')
  const accessPlan = isAdminEmail(user.email) ? 'ADMIN' : plan
  void dbService.deleteExpiredCampaignsForUser(user.id, plan)

  const [brands, campaigns] = await Promise.all([
    getCachedBrands(user.id),
    dbService.getCampaignSummaries(user.id),
  ])

  const brandProfile = brands.find((b) => b.websiteUrl !== 'general_profile') || null
  const generalProfile = brands.find((b) => b.websiteUrl === 'general_profile') || null

  const summarizedPreference = brandProfile
    ? await dbService.getSummarizedPreference(brandProfile.id)
    : null

  const serializedBrand = brandProfile
    ? {
        id: brandProfile.id,
        name: brandProfile.name,
        industry: brandProfile.industry,
        targetAudience: brandProfile.targetAudience,
        toneOfVoice: brandProfile.toneOfVoice,
        mainColor: brandProfile.mainColor,
        forbiddenWords: brandProfile.forbiddenWords,
        ctaStyle: brandProfile.ctaStyle,
        brandDna: brandProfile.brandDna,
        websiteUrl: brandProfile.websiteUrl,
      }
    : null

  const serializedGeneralProfile = generalProfile
    ? {
        id: generalProfile.id,
        name: generalProfile.name,
        industry: generalProfile.industry,
        targetAudience: generalProfile.targetAudience,
        toneOfVoice: generalProfile.toneOfVoice,
        mainColor: generalProfile.mainColor,
        forbiddenWords: generalProfile.forbiddenWords,
        ctaStyle: generalProfile.ctaStyle,
        brandDna: generalProfile.brandDna,
        websiteUrl: generalProfile.websiteUrl,
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
      existingGeneralProfile={serializedGeneralProfile}
      campaigns={serializedCampaigns}
      planName={PRICING_PLANS[plan].name}
      retentionDays={PRICING_PLANS[plan].historyRetentionDays}
      canUpgradeRetention={plan !== 'UNLIMITED'}
      userEmail={user.email}
      userId={user.id}
      userName={user.name}
      summarizedPreference={summarizedPreference}
      userPlan={accessPlan}
      canAccessShortsLab={canAccessShortsLab(user.email)}
      shortsLabAccess={await getShortsLabAccess(user)}
    />
  )
}
