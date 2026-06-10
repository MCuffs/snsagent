import { MarketingFooter } from '../components/MarketingFooter'
import { MarketingNav } from '../components/MarketingNav'

export const metadata = {
  title: 'Privacy — Shuffla',
  description: 'Shuffla 개인정보 처리 안내',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#fbfaf7] text-[#171714]">
      <MarketingNav />
      <section className="mx-auto max-w-3xl px-5 py-20 md:px-8 md:py-28">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#847d73]">Privacy</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] md:text-5xl">개인정보 처리 안내</h1>
        <div className="mt-10 space-y-8 text-sm leading-7 text-[#625c53]">
          <section>
            <h2 className="text-base font-semibold text-[#171714]">개인정보 처리자</h2>
            <p className="mt-3">
              <strong>파랑버섯 스튜디오</strong>(이하 "회사")는 Shuffla 서비스 제공을 위해 아래와 같이 개인정보를 처리합니다.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-[#171714]">수집하는 정보</h2>
            <p className="mt-3">
              Shuffla는 로그인 계정 정보, 브랜드 설정, 생성 요청, 편집 결과, 결제 상태처럼 서비스 제공에 필요한 정보를 저장합니다.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-[#171714]">이용 목적</h2>
            <p className="mt-3">
              수집한 정보는 사용자 인증, 브랜드 프로필 저장, 카드뉴스 생성과 편집, 작업 히스토리 제공, 결제 권한 확인에 사용됩니다.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-[#171714]">외부 서비스</h2>
            <p className="mt-3">
              서비스 제공을 위해 Google OAuth, AI 생성 공급자, 파일 저장소, 결제 제공자와 연동될 수 있습니다.
              각 외부 서비스에는 요청 처리에 필요한 최소 정보만 전달됩니다.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-[#171714]">문의</h2>
            <p className="mt-3">개인정보 관련 문의는 admin@shuffla.io로 보내주세요.</p>
          </section>
        </div>
      </section>
      <MarketingFooter />
    </main>
  )
}
