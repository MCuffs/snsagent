import { loadTrending } from '../../../shorts-lab/trending'
import { getSessionUser } from '../../../../lib/auth/user'

// "목록 새로고침" 버튼용. 최초 로딩은 page.tsx(서버 컴포넌트)에서 직접 처리합니다.
// 차트 열람은 로그인한 모든 유저에게 허용됩니다 (유료 게이트는 생성 단계에서 적용).

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  return Response.json(await loadTrending())
}
