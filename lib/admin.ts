import { redirect } from 'next/navigation'
import { getSessionUser } from './auth/user'
import { isAdminEmail } from './auth/admin-emails'
export { isAdminEmail }


export async function getAdminUser() {
  const user = await getSessionUser()
  if (!user) return null
  return isAdminEmail(user.email) ? user : null
}

export async function requireAdminUser() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!isAdminEmail(user.email)) redirect('/')
  return user
}
