import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSessionUser, getCachedBrands } from '../../../lib/auth/user'
import { dbService } from '../../../lib/db-service'
import DashboardContainer from './DashboardContainer'
import { Loader2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

function DashboardFallback() {
  return (
    <div className="flex h-full items-center justify-center p-12">
      <Loader2 className="h-8 w-8 animate-spin text-[#71717a]" />
    </div>
  )
}

export default async function ConceptPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [brands, campaigns] = await Promise.all([
    getCachedBrands(user.id),
    dbService.getCampaigns(user.id),
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

  const serializedCampaigns = campaigns.map((c) => ({
    id: c.id,
    title: c.title,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    thumbnail: c.slides?.[0]?.imageUrl ?? null,
  }))

  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardContainer existingBrand={serializedBrand} campaigns={serializedCampaigns} />
    </Suspense>
  )
}
