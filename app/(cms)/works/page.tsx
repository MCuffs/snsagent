import { redirect } from 'next/navigation'
import { getSessionUser, getCachedBrands } from '../../../lib/auth/user'
import { dbService } from '../../../lib/db-service'
import WorksGrid from './WorksGrid'

export const dynamic = 'force-dynamic'

export default async function WorksPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [brands, campaigns] = await Promise.all([
    getCachedBrands(user.id),
    dbService.getCampaigns(user.id)
  ])

  if (brands.length === 0 || !brands[0].websiteUrl) {
    redirect('/concept')
  }

  return (
    <WorksGrid
      campaigns={campaigns.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
        thumbnail: c.slides?.[0]?.imageUrl ?? null,
      }))}
    />
  )
}
