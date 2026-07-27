import { loadTrending } from '../../../shorts-lab/trending'

// "목록 새로고침" 버튼용. 최초 로딩은 page.tsx(서버 컴포넌트)에서 직접 처리합니다.

export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json(await loadTrending())
}
