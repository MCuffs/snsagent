import { loadTrending } from '../../../shorts-lab/trending'
import { getSessionUser } from '../../../../lib/auth/user'
import { canAccessShortsLab } from '../../../../lib/auth/shorts-lab-access'

// "목록 새로고침" 버튼용. 최초 로딩은 page.tsx(서버 컴포넌트)에서 직접 처리합니다.

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getSessionUser()
  if (!canAccessShortsLab(user?.email)) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  return Response.json(await loadTrending())
}
