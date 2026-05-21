import { redirect } from 'next/navigation'
import { getSessionUser } from '../../../actions'
import { dbService } from '../../../../lib/db-service'
import { PRICING_PLANS, SubscriptionPlan } from '../../../../lib/limits'
import CampaignResultView from './CampaignResultView'

export const dynamic = 'force-dynamic'

export default async function CampaignDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getSessionUser()
  if (!user) {
    redirect('/login')
  }

  const { id } = await params
  
  // Fetch Campaign
  const campaign = await dbService.getCampaign(id)
  if (!campaign) {
    redirect('/dashboard')
  }

  // Fetch Brand
  const brand = await dbService.getBrand(campaign.brandId)
  if (!brand) {
    redirect('/dashboard')
  }

  // Fetch associated Post
  const posts = await dbService.getPosts(user.id)
  const post = posts.find(p => p.campaignId === campaign.id)
  
  if (!post) {
    redirect('/dashboard')
  }

  // Enforce SaaS pricing rules
  const userPlan = (user.plan || 'FREE') as SubscriptionPlan
  const planConfig = PRICING_PLANS[userPlan]
  const hasWatermark = planConfig.hasWatermark
  const canSchedule = planConfig.canSchedule

  // Format objects for client serialization
  const serializedCampaign = {
    id: campaign.id,
    title: campaign.title,
    productName: campaign.productName,
    productDescription: campaign.productDescription,
    keyBenefits: campaign.keyBenefits,
    objective: campaign.objective,
    slideCount: campaign.slideCount,
    status: campaign.status,
    slides: campaign.slides.map(s => ({
      id: s.id,
      slideNumber: s.slideNumber,
      headline: s.headline,
      body: s.body,
      designPrompt: s.designPrompt,
      imageUrl: s.imageUrl,
    }))
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
  }

  return (
    <CampaignResultView
      campaign={serializedCampaign}
      post={serializedPost}
      brand={serializedBrand}
      userPlan={userPlan}
      hasWatermark={hasWatermark}
      canSchedule={canSchedule}
    />
  )
}
