import { redirect } from 'next/navigation'
import { getSessionUser } from '../../../../../lib/auth/user'
import { dbService } from '../../../../../lib/db-service'
import { PRICING_PLANS } from '../../../../../lib/limits'
import { normalizePlan } from '../../../../../lib/limits-types'
import { getHistoryRetentionStatus } from '../../../../../lib/history-retention'
import CampaignResultView from '../../../../(cms)/campaign/[id]/CampaignResultView'

export const dynamic = 'force-dynamic'

export default async function CampaignDetailsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const [{ locale, id }, user] = await Promise.all([params, getSessionUser()])
  if (!user) redirect(`/${locale}/login`)

  const campaign = await dbService.getCampaign(id)
  if (!campaign || campaign.userId !== user.id) redirect(`/${locale}/concept?tab=works`)

  const userPlan = normalizePlan(user.plan || 'FREE')
  if (getHistoryRetentionStatus(campaign.createdAt, userPlan).isExpired) {
    await dbService.deleteCampaign(user.id, campaign.id)
    redirect(`/${locale}/concept?tab=works`)
  }

  const [brand, post] = await Promise.all([
    dbService.getBrand(campaign.brandId),
    dbService.getPostByCampaign(user.id, campaign.id),
  ])
  if (!brand || !post) redirect(`/${locale}/concept?tab=works`)

  const planName = PRICING_PLANS[userPlan].name

  const serializedCampaign = {
    id: campaign.id,
    title: campaign.title,
    productName: campaign.productName,
    productDescription: campaign.productDescription,
    keyBenefits: campaign.keyBenefits,
    objective: campaign.objective,
    slideCount: campaign.slideCount,
    status: campaign.status,
    imageModel: campaign.imageModel,
    initialImageCount: campaign.initialImageCount,
    regenerationImageCount: campaign.regenerationImageCount,
    lastRegenerationImageModel: campaign.lastRegenerationImageModel,
    slides: campaign.slides.map(s => ({
      id: s.id,
      slideNumber: s.slideNumber,
      headline: s.headline,
      body: s.body,
      designPrompt: s.designPrompt,
      imageUrl: s.imageUrl,
      backgroundImageUrl: s.backgroundImageUrl,
      fontPreset: s.fontPreset,
      textColor: s.textColor,
      headlineFontSize: s.headlineFontSize,
      bodyFontSize: s.bodyFontSize,
      editorDocument: s.editorDocument,
    })),
  }

  const serializedPost = {
    id: post.id,
    caption: post.caption,
    hashtags: post.hashtags,
    scheduledAt: post.scheduledAt.toISOString(),
  }

  const serializedBrand = {
    name: brand.name,
    mainColor: brand.mainColor,
    ctaStyle: brand.ctaStyle,
    editorPreferences: brand.editorPreferences || null,
  }

  return (
    <CampaignResultView
      campaign={serializedCampaign}
      post={serializedPost}
      brand={serializedBrand}
      planName={planName}
      regenerationAccess={userPlan === 'FREE' ? 'blocked' : userPlan === 'LITE' ? 'single-use' : 'included'}
    />
  )
}
