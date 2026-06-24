import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../lib/auth/user'
import { getUsageSummaryForUser } from '../../../lib/usage-summary'

export const runtime = 'nodejs'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  return NextResponse.json(await getUsageSummaryForUser(user))
}
