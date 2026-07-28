import type { Metadata } from 'next'
import ShortsLab from '../../shorts-lab/ShortsLab'
import { loadTrending } from '../../shorts-lab/trending'
import '../../shorts-lab/shorts-lab.css'
import { notFound } from 'next/navigation'
import { getSessionUser } from '../../../lib/auth/user'
import { getShortsLabAccess } from '../../../lib/shorts-lab-usage'

export const metadata: Metadata = {
  title: 'Shorts Lab — 구조 검증 데모',
  description:
    '실시간 인기 롱폼 → 재사용 가능 여부 확인 → 숏폼 자동 생성 → 댓글 캡처 파이프라인 데모',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function LocalizedShortsLabPage() {
  const user = await getSessionUser()
  if (!user) notFound()
  const [initial, access] = await Promise.all([
    loadTrending(),
    getShortsLabAccess(user),
  ])
  return <ShortsLab initial={initial} userId={user.id} access={access} />
}
