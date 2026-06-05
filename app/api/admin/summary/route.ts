import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../lib/auth/user'
import { isAdminEmail } from '../../../../lib/admin'
import prisma from '../../../../lib/db'

export const runtime = 'nodejs'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const [users, generationsToday, failedToday] = await Promise.all([
    prisma.user.count(),
    prisma.campaign.count({ where: { createdAt: { gte: start } } }),
    prisma.campaign.count({ where: { createdAt: { gte: start }, status: 'failed' } }),
  ])

  return NextResponse.json({ users, generationsToday, failedToday })
}
