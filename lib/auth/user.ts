import { cache } from 'react'
import { cookies } from 'next/headers'
import { dbService, User } from '../db-service'
import { readSessionEmail, SESSION_COOKIE_NAME } from './session'

export const getSessionUser = cache(async (): Promise<User | null> => {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const email = readSessionEmail(token)
  if (!email) return null

  try {
    const user = await dbService.getUserByEmail(email)
    if (user?.accountStatus && user.accountStatus !== 'active') return null
    return user
  } catch (e) {
    console.error('Failed to get session user:', e)
    return null
  }
})

export const getCachedBrands = cache(async (userId: string) => {
  return await dbService.getBrands(userId)
})
