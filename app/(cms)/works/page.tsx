import { redirect } from 'next/navigation'
import { getSessionUser } from '../../actions'
import { dbService } from '../../../lib/db-service'
import WorksGrid from './WorksGrid'

export const dynamic = 'force-dynamic'

export default async function WorksPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const brands = await dbService.getBrands(user.id)
  if (brands.length === 0 || !brands[0].websiteUrl) {
    redirect('/concept')
  }

  const campaigns = await dbService.getCampaigns(user.id)

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
