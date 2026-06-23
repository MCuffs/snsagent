import { NextRequest } from 'next/server'
import { getSessionUser } from '../../../actions/auth'
import { canUseKling, getKlingVideoModel } from '../../../../src/lib/ai/providers/klingVideoProvider'

export const runtime = 'nodejs'

export async function POST(_request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return Response.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  if (!canUseKling()) {
    return Response.json(
      {
        ok: false,
        provider: 'kling',
        model: getKlingVideoModel(),
        error: 'Kling 영상 생성 API가 설정되지 않았습니다.',
      },
      { status: 503 },
    )
  }

  return Response.json({
    ok: true,
    provider: 'kling',
    model: getKlingVideoModel(),
  })
}
