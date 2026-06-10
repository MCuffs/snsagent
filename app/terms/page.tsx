import { MarketingFooter } from '../components/MarketingFooter'
import { MarketingNav } from '../components/MarketingNav'

export const metadata = {
  title: 'Terms — Shuffla',
  description: 'Shuffla 서비스 이용약관',
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#fbfaf7] text-[#171714]">
      <MarketingNav />
      <section className="mx-auto max-w-3xl px-5 py-20 md:px-8 md:py-28">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#847d73]">Terms</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] md:text-5xl">서비스 이용약관</h1>
        <div className="mt-10 space-y-8 text-sm leading-7 text-[#625c53]">
          <section>
            <h2 className="text-base font-semibold text-[#171714]">서비스 제공자</h2>
            <p className="mt-3">
              본 서비스는 <strong>파랑버섯 스튜디오</strong>(이하 "회사")가 운영하는 AI 콘텐츠 제작 도구 Shuffla를 통해 제공됩니다.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-[#171714]">서비스 범위</h2>
            <p className="mt-3">
              Shuffla는 브랜드 분석, 카드뉴스 생성, 편집, 다운로드를 제공하는 AI 콘텐츠 제작 도구입니다.
              생성 결과는 사용자가 검토하고 수정한 뒤 활용해야 합니다.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-[#171714]">사용자 책임</h2>
            <p className="mt-3">
              사용자는 입력한 브랜드 자료, 참고 이미지, 생성 결과의 사용 권리와 법적 적합성을 직접 확인해야 합니다.
              타인의 권리, 개인정보, 상표권, 저작권을 침해하는 방식으로 서비스를 사용할 수 없습니다.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-[#171714]">결제 및 이용 한도</h2>
            <p className="mt-3">
              유료 플랜의 생성 횟수, 보관 기간, 재생성 권한은 요금제 화면에 표시된 기준을 따릅니다.
              외부 결제 제공자의 승인, 취소, 실패 상태에 따라 계정 권한이 변경될 수 있습니다.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-[#171714]">문의</h2>
            <p className="mt-3">서비스 이용과 약관 관련 문의는 admin@shuffla.io로 보내주세요.</p>
          </section>
        </div>
      </section>
      <MarketingFooter />
    </main>
  )
}
