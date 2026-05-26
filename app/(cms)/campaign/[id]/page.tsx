import { redirect } from 'next/navigation'
import { getSessionUser } from '../../../actions'
import { dbService } from '../../../../lib/db-service'
import { PRICING_PLANS } from '../../../../lib/limits'
import { normalizePlan } from '../../../../lib/limits-types'
import CampaignResultView from './CampaignResultView'

export const dynamic = 'force-dynamic'

export default async function CampaignDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const { id } = await params

  const campaign = await dbService.getCampaign(id)
  if (!campaign || campaign.userId !== user.id) redirect('/works')

  const brand = await dbService.getBrand(campaign.brandId)
  if (!brand) redirect('/works')

  const posts = await dbService.getPosts(user.id)
  const post = posts.find(p => p.campaignId === campaign.id)
  if (!post) redirect('/works')

  const userPlan = normalizePlan(user.plan || 'FREE')
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
      planName={planName}
    />
  )
}
