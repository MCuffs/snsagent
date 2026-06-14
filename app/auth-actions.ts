'use server'

import { cookies } from 'next/headers'
import { dbService, User } from '../lib/db-service'
import { isProduction } from '../lib/env'
import {
  createSessionToken,
  LEGACY_SESSION_COOKIE_NAME,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
} from '../lib/auth/session'
import { hashPassword, verifyPassword } from '../lib/password'

function failed(error: string) {
  return { success: false as const, error }
}

export async function loginAction(email: string, name?: string) {
  if (isProduction()) {
    return failed('운영 환경에서는 Google 로그인을 사용해 주세요.')
  }

  if (!email || !email.includes('@')) {
    return failed('올바른 이메일 주소를 입력해 주세요.')
  }

  const user = await dbService.getOrCreateUser(email.trim().toLowerCase(), name)
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, createSessionToken(user.email), sessionCookieOptions())
  cookieStore.delete(LEGACY_SESSION_COOKIE_NAME)

  return { success: true as const, user }
}

export async function registerAction(email: string, password: string, name?: string) {
  if (!email || !email.includes('@')) return failed('올바른 이메일 주소를 입력해 주세요.')
  if (!password || password.length < 8) return failed('비밀번호는 8자 이상이어야 합니다.')

  const normalizedEmail = email.trim().toLowerCase()
  const existing = await dbService.getUserByEmail(normalizedEmail)
  if (existing) return failed('이미 가입된 이메일입니다. 로그인해 주세요.')

  const ph = await hashPassword(password)
  const user = await dbService.createUserWithPassword(
    normalizedEmail,
    ph,
    name?.trim() || normalizedEmail.split('@')[0],
  )
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, createSessionToken(user.email), sessionCookieOptions())
  cookieStore.delete(LEGACY_SESSION_COOKIE_NAME)
  return { success: true as const, user }
}

export async function loginWithPasswordAction(email: string, password: string) {
  if (!email || !email.includes('@')) return failed('올바른 이메일 주소를 입력해 주세요.')
  if (!password) return failed('비밀번호를 입력해 주세요.')

  const normalizedEmail = email.trim().toLowerCase()
  const user = await dbService.getUserByEmail(normalizedEmail)
  if (!user || !(user as User & { passwordHash?: string }).passwordHash) {
    return failed('이메일 또는 비밀번호가 올바르지 않습니다.')
  }

  const ok = await verifyPassword(password, (user as User & { passwordHash: string }).passwordHash)
  if (!ok) return failed('이메일 또는 비밀번호가 올바르지 않습니다.')

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, createSessionToken(user.email), sessionCookieOptions())
  cookieStore.delete(LEGACY_SESSION_COOKIE_NAME)
  return { success: true as const, user }
}

export async function logoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
  cookieStore.delete(LEGACY_SESSION_COOKIE_NAME)
  return { success: true as const }
}
