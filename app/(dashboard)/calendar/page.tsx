import { redirect } from 'next/navigation'
import { getSessionUser } from '../../actions'
import { dbService } from '../../../lib/db-service'

export const dynamic = 'force-dynamic'

export default async function ContentCalendarPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const brands = await dbService.getBrands(user.id)
  if (brands.length === 0) {
    redirect('/concept')
  }

  redirect('/works')
}
