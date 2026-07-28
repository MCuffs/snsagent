import type { Metadata } from 'next'
import ShortsLab from './ShortsLab'
import { loadTrending } from './trending'
import './shorts-lab.css'
import { notFound } from 'next/navigation'
import { getSessionUser } from '../../lib/auth/user'
import { hasShortsLabFullAccess } from '../../lib/auth/shorts-lab-access'

export const metadata: Metadata = {
  title: 'Shorts Lab — 구조 검증 데모',
  description:
    '실시간 인기 롱폼 → 재사용 가능 여부 확인 → 숏폼 자동 생성 → 댓글 캡처 파이프라인 데모',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function ShortsLabPage() {
  const user = await getSessionUser()
  if (!user) notFound()
  const initial = await loadTrending()
  return (
    <ShortsLab
      initial={initial}
      userId={user.id}
      locked={!hasShortsLabFullAccess(user)}
    />
  )
}
