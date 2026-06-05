import { redirect } from 'next/navigation'
import { getSessionUser } from './auth/user'

export const ADMIN_EMAILS = (process.env.SUPER_USER_EMAILS || 'alstnwjd0424@gmail.com,imhs1248@gmail.com,kanghiee616@gmail.com')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean)

export function isAdminEmail(email?: string | null) {
  return Boolean(email && ADMIN_EMAILS.includes(email.toLowerCase()))
}

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
