import { redirect } from 'next/navigation'
import { getSessionUser } from '../../actions'
import { dbService } from '../../../lib/db-service'
import CalendarView from './CalendarView'

export const dynamic = 'force-dynamic'

export default async function ContentCalendarPage() {
  const user = await getSessionUser()
  if (!user) {
    redirect('/login')
  }

  // Fetch all posts for the user
  const posts = await dbService.getPosts(user.id)

  // Map database posts format to UI view model
  const serializedPosts = posts.map(p => ({
    id: p.id,
    campaignId: p.campaignId,
    caption: p.caption,
    hashtags: p.hashtags,
    scheduledAt: p.scheduledAt.toISOString(),
    status: p.status,
    campaign: {
      title: p.campaign.title,
      slideCount: p.campaign.slideCount,
      slides: (p.campaign.slides || []).map(s => ({
        imageUrl: s.imageUrl
      }))
    },
    brand: {
      name: p.brand.name
    }
  }))

  return (
    <CalendarView posts={serializedPosts} />
  )
}
