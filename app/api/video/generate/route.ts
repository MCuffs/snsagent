import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '../../../../lib/auth/user'

export const runtime = 'nodejs'

export async function POST(_request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const apiKey = process.env.SEEDANCE_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: '영상 생성 기능은 현재 준비 중입니다. 곧 서비스됩니다.' },
      { status: 503 }
    )
  }

  // TODO: Seedance API 호출 구현
  // const body = await _request.json()
  // const { prompt, referenceImageUrl, durationSec } = body
  return NextResponse.json({ error: 'Not yet implemented' }, { status: 501 })
}
