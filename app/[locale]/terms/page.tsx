import { MarketingFooter } from '../../components/MarketingFooter'
import { MarketingNav } from '../../components/MarketingNav'
import { getSessionUser } from '../../../lib/auth/user'
import { getTranslations } from 'next-intl/server'

interface TermsSection {
  title: string
  paragraphs?: string[]
  orderedItems?: string[]
  items?: string[]
  contact?: boolean
}

const koreanTermsSections: TermsSection[] = [
  {
    title: '제1조 목적',
    paragraphs: [
      '본 약관은 파랑버섯 스튜디오(이하 “회사”)가 제공하는 AI 콘텐츠 제작 서비스(이하 “서비스”)의 이용과 관련하여 회사와 이용자 간의 권리, 의무, 책임사항 및 기타 필요한 사항을 정하는 것을 목적으로 합니다.',
    ],
  },
  {
    title: '제2조 정의',
    paragraphs: ['본 약관에서 사용하는 용어의 뜻은 다음과 같습니다.'],
    orderedItems: [
      '“서비스”란 회사가 제공하는 AI 기반 브랜드 분석, 카드뉴스 생성, 콘텐츠 편집, 저장, 다운로드 및 관련 부가 기능을 말합니다.',
      '“이용자”란 본 약관에 동의하고 서비스를 이용하는 개인 또는 법인을 말합니다.',
      '“회원”이란 서비스에 가입하여 계정을 생성한 이용자를 말합니다.',
      '“콘텐츠”란 이용자가 서비스에 입력, 업로드, 생성, 편집, 저장 또는 다운로드하는 텍스트, 이미지, 로고, 브랜드 자료, 카드뉴스, 생성 결과물 등 모든 디지털 자료를 말합니다.',
      '“AI 생성 결과물”이란 이용자가 입력한 요청, 브랜드 정보, 참고자료 등을 바탕으로 서비스 내 AI 기능을 통해 생성된 문구, 이미지, 편집안, 카드뉴스 결과물 등을 말합니다.',
      '“유료 서비스”란 회사가 정한 요금제에 따라 결제 후 이용할 수 있는 생성 횟수, 저장 기간, 다운로드, 재생성 등 유료 기능을 말합니다.',
    ],
  },
  {
    title: '제3조 약관의 효력 및 변경',
    orderedItems: [
      '본 약관은 이용자가 서비스에 가입하거나 서비스를 이용함으로써 효력이 발생합니다.',
      '회사는 관련 법령을 위반하지 않는 범위에서 본 약관을 변경할 수 있습니다.',
      '약관이 변경되는 경우 회사는 변경 내용과 시행일을 서비스 화면 또는 웹사이트를 통해 공지합니다.',
      '이용자가 변경된 약관에 동의하지 않는 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다. 변경된 약관 시행일 이후에도 서비스를 계속 이용하는 경우 변경된 약관에 동의한 것으로 봅니다.',
      '회사는 허위 정보 입력, 타인 계정 도용, 이전 약관 위반, 서비스 운영 방해 우려가 있는 경우 회원가입 또는 서비스 이용을 제한할 수 있습니다.',
    ],
  },
  {
    title: '제4조 서비스의 제공',
    orderedItems: [
      '회사는 이용자에게 브랜드 정보 입력 및 관리, AI 기반 카드뉴스 및 SNS 콘텐츠 생성, 생성 결과물 편집·저장·다운로드, 작업 히스토리 저장, 요금제별 생성 횟수 및 보관 기능, 기타 회사가 정하는 부가 기능을 제공합니다.',
      '회사는 서비스 개선, 운영상 필요, 기술적 사유에 따라 서비스의 일부 또는 전부를 변경할 수 있습니다.',
      '회사는 점검, 업데이트, 장애 대응을 위해 서비스 이용을 일시적으로 제한할 수 있습니다.',
    ],
  },
  {
    title: '제5조 이용자의 의무',
    orderedItems: [
      '이용자는 서비스를 이용할 때 관련 법령, 본 약관, 서비스 안내 및 회사의 운영 정책을 준수해야 합니다.',
      '이용자는 아래 금지 행위를 해서는 안 됩니다.',
    ],
    items: [
      '타인의 개인정보, 계정, 결제수단을 도용하는 행위',
      '타인의 저작권, 상표권, 초상권, 개인정보 등 권리를 침해하는 행위',
      '불법, 음란, 혐오, 명예훼손, 사기, 허위정보 유포 등 부적절한 목적으로 서비스를 이용하는 행위',
      '회사의 서버, 네트워크, 보안 시스템을 침해하거나 서비스 운영을 방해하는 행위',
      '자동화 도구, 봇, 스크래핑 등을 통해 서비스를 비정상적으로 이용하는 행위',
      '회사의 사전 동의 없이 서비스를 복제, 판매, 임대, 재판매하거나 상업적으로 대행 이용하는 행위',
      '기타 관련 법령 또는 공서양속에 반하는 행위',
    ],
    paragraphs: [
      '이용자는 자신이 입력, 업로드, 생성, 편집, 배포하는 콘텐츠에 대한 권리와 법적 적합성을 직접 확인해야 합니다.',
    ],
  },
  {
    title: '제6조 AI 생성 결과물에 대한 책임',
    orderedItems: [
      '서비스는 AI를 활용하여 콘텐츠 초안을 생성하는 도구이며, AI 생성 결과물의 정확성, 완전성, 적법성, 특정 목적 적합성을 보장하지 않습니다.',
      '이용자는 AI 생성 결과물을 사용하기 전에 사실관계, 저작권, 상표권, 초상권, 개인정보, 광고 심의, 플랫폼 정책 위반 여부를 직접 검토해야 합니다.',
      'AI 생성 결과물의 활용, 게시, 배포, 광고 집행, 상업적 이용으로 발생하는 책임은 이용자에게 있습니다.',
      '회사는 AI 생성 결과물이 이용자의 기대와 다르거나, 이용자가 이를 수정 없이 사용하여 발생한 손해에 대해 책임을 지지 않습니다. 단, 회사의 고의 또는 중대한 과실이 있는 경우는 제외합니다.',
    ],
  },
  {
    title: '제7조 콘텐츠 및 지식재산권',
    orderedItems: [
      '이용자가 서비스에 입력하거나 업로드한 자료의 권리는 이용자 또는 정당한 권리자에게 있습니다.',
      '이용자는 서비스 이용에 필요한 범위에서 회사가 입력 자료, 업로드 파일, 브랜드 정보, 생성 요청 및 결과물을 처리, 저장, 변환, 표시할 수 있는 제한적 이용권을 회사에 부여합니다.',
      '이용자가 서비스를 통해 생성한 AI 생성 결과물에 대한 권리는 관련 법령 및 제3자 권리를 침해하지 않는 범위에서 이용자에게 귀속됩니다.',
      '회사는 서비스, 소프트웨어, UI, 디자인, 로고, 시스템, 기술, 데이터베이스, 운영 노하우 등에 대한 권리를 보유합니다.',
      '이용자는 회사의 사전 동의 없이 서비스 자체, 소프트웨어, 화면 구성, 기능, 데이터베이스를 복제, 수정, 배포, 판매, 대여, 역설계하거나 경쟁 서비스 개발에 이용할 수 없습니다.',
      '회사는 서비스 운영, 오류 분석, 보안, 품질 개선을 위해 필요한 범위에서 이용자의 콘텐츠를 처리할 수 있습니다.',
    ],
  },
  {
    title: '제8조 외부 서비스 및 제3자 서비스',
    orderedItems: [
      '회사는 서비스 제공을 위해 Google OAuth, OpenAI, Google Gemini, Vercel, 파일 저장 서비스, 결제 제공자 등 외부 서비스를 이용할 수 있습니다.',
      '외부 서비스의 장애, 정책 변경, API 제한, 결제 승인 실패, 계정 제한 등으로 인해 서비스 일부 기능이 제한될 수 있습니다.',
      '이용자가 외부 서비스 또는 외부 플랫폼의 약관, 정책, 저작권 기준을 위반하여 발생한 문제에 대해 회사는 책임을 지지 않습니다.',
      '결제는 외부 결제 제공자를 통해 처리되며, 회사는 카드번호, CVC, 계좌번호 등 직접적인 결제수단 정보를 저장하지 않습니다.',
    ],
  },
  {
    title: '제9조 유료 서비스 및 결제',
    orderedItems: [
      '회사는 일부 기능을 유료로 제공할 수 있으며, 유료 서비스의 내용, 가격, 생성 횟수, 보관 기간, 다운로드 권한, 재생성 권한 등은 요금제 화면에 따릅니다.',
      '유료 서비스는 결제가 완료된 후 이용할 수 있습니다.',
      '결제 승인, 취소, 실패, 환불 처리 상태에 따라 서비스 이용 권한이 변경될 수 있습니다.',
      '회사는 서비스 운영상 필요에 따라 요금제, 가격, 제공 기능, 생성 횟수, 보관 기간을 변경할 수 있으며, 변경 사항은 서비스 화면 또는 웹사이트를 통해 안내합니다.',
      '이용자가 구독을 해지하거나 플랜을 변경하는 경우, 적용 시점과 이용 가능 범위는 서비스 화면에 표시된 기준을 따릅니다.',
    ],
  },
  {
    title: '제10조 환불 및 청약철회',
    orderedItems: [
      '이용자는 결제일로부터 7일 이내에 환불을 요청할 수 있습니다.',
      '결제 후 유료 기능을 전혀 사용하지 않은 경우에는 결제일로부터 7일 이내 요청에 한해 전액 환불이 가능합니다.',
      '단, 결제 후 AI 생성 기능, 카드뉴스 생성, AI 재생성, 다운로드, 편집 결과 저장 등 유료 기능을 1회라도 사용한 경우에는 디지털 콘텐츠 제공이 개시된 것으로 보아 환불이 제한될 수 있습니다.',
      '아래 각 호의 경우 환불이 제한될 수 있습니다.',
    ],
    items: [
      'AI 생성 기능을 사용한 경우',
      '카드뉴스 생성 또는 재생성을 진행한 경우',
      '생성 결과물을 다운로드한 경우',
      '유료 플랜의 저장, 편집, 내보내기 기능을 사용한 경우',
      '이용자의 귀책사유로 계정이 정지되거나 이용계약이 해지된 경우',
      '프로모션, 할인, 이벤트 등 별도 조건으로 제공된 이용권을 사용한 경우',
    ],
    paragraphs: [
      '회사의 귀책사유로 결제가 중복 처리되거나 서비스 제공이 불가능한 경우, 회사는 확인 후 환불 또는 합리적인 보상 조치를 제공합니다.',
      '환불은 원칙적으로 이용자가 결제한 수단으로 처리되며, 결제 제공자 또는 카드사의 정책에 따라 실제 환급까지 일정 기간이 소요될 수 있습니다.',
      '환불 요청은 이메일 또는 공식 문의 채널을 통해 접수할 수 있습니다.',
    ],
  },
  {
    title: '제11조 서비스 이용 제한, 탈퇴 및 종료',
    orderedItems: [
      '회사는 이용자가 본 약관을 위반하거나 서비스의 정상 운영을 방해하는 경우 서비스 이용을 제한하거나 이용계약을 해지할 수 있습니다.',
      '아래 각 호의 경우 회사는 사전 통지 없이 이용을 제한할 수 있습니다.',
    ],
    items: [
      '타인의 권리 또는 개인정보를 침해한 경우',
      '불법적 목적 또는 부정한 방법으로 서비스를 이용한 경우',
      '결제수단 도용, 결제 분쟁 남용, 환불 악용이 의심되는 경우',
      '해킹, 악성코드, 자동화 도구 등으로 서비스에 피해를 주는 경우',
      '회사 또는 제3자에게 중대한 손해를 발생시킬 우려가 있는 경우',
    ],
    paragraphs: [
      '이용자는 언제든지 회원 탈퇴를 요청할 수 있습니다.',
      '회원 탈퇴 시 개인정보 및 저장된 콘텐츠는 개인정보처리방침과 관련 법령에 따라 처리됩니다.',
      '회사는 시스템 점검, 장애, 보안 사고, 외부 서비스 장애, 천재지변, 경영상 필요 등으로 서비스의 전부 또는 일부를 일시 중단할 수 있습니다.',
      '회사가 서비스를 종료하는 경우, 종료 예정일 30일 전까지 서비스 화면 또는 웹사이트를 통해 공지합니다.',
    ],
  },
  {
    title: '제12조 미성년자 이용',
    orderedItems: [
      '파랑버섯 스튜디오는 원칙적으로 만 14세 미만 아동의 회원가입 및 서비스 이용을 허용하지 않습니다.',
      '만 19세 미만 미성년자가 유료 서비스를 이용하는 경우 법정대리인의 동의가 필요할 수 있습니다.',
      '법정대리인의 동의 없이 체결된 미성년자의 유료 결제는 관련 법령에 따라 취소될 수 있습니다.',
    ],
  },
  {
    title: '제13조 책임 제한 및 손해배상',
    orderedItems: [
      '회사는 천재지변, 장애, 해킹, 외부 서비스 장애, 통신망 장애 등 회사의 합리적 통제 범위를 벗어난 사유로 서비스를 제공할 수 없는 경우 책임을 지지 않습니다.',
      '회사는 이용자의 귀책사유로 발생한 서비스 이용 장애, 데이터 손실, 계정 접근 문제에 대해 책임을 지지 않습니다.',
      '회사는 AI 생성 결과물의 정확성, 완전성, 법적 적합성, 상업적 성과를 보장하지 않습니다.',
      '회사는 이용자가 서비스를 통해 기대한 수익, 노출, 전환, 팔로워 증가, 광고 성과를 얻지 못한 것에 대해 책임을 지지 않습니다.',
      '회사는 무료 서비스 이용과 관련하여 관련 법령상 허용되는 범위 내에서 책임을 부담하지 않습니다.',
      '회사의 책임이 인정되는 경우에도 회사의 책임 범위는 이용자가 최근 3개월 동안 회사에 실제로 지급한 이용금액을 한도로 합니다. 단, 회사의 고의 또는 중대한 과실이 있는 경우는 제외합니다.',
      '이용자가 본 약관 또는 관련 법령을 위반하여 회사에 손해를 발생시킨 경우, 이용자는 회사에 발생한 손해를 배상해야 합니다.',
      '이용자의 콘텐츠, 생성 결과물 사용, 제3자 권리 침해, 불법적 이용으로 인해 회사가 제3자로부터 청구, 소송, 손해배상 요구를 받은 경우, 이용자는 자신의 책임과 비용으로 이를 해결해야 합니다.',
    ],
  },
  {
    title: '제14조 개인정보 보호 및 분쟁 해결',
    orderedItems: [
      '회사는 서비스 제공을 위해 필요한 범위에서 이용자의 개인정보를 처리하며, 개인정보 처리에 관한 자세한 사항은 회사의 개인정보처리방침에 따릅니다.',
      '회사와 이용자는 서비스 이용과 관련하여 분쟁이 발생한 경우 성실히 협의하여 해결하도록 노력합니다.',
      '본 약관은 대한민국 법률에 따라 해석됩니다.',
      '서비스 이용과 관련하여 소송이 제기되는 경우, 관련 법령에 따른 관할 법원을 제1심 관할 법원으로 합니다.',
    ],
  },
  {
    title: '제15조 문의',
    paragraphs: [
      '서비스 이용, 결제, 환불, 약관과 관련한 문의는 아래 연락처로 접수할 수 있습니다.',
    ],
    contact: true,
  },
]

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isEn = locale === 'en'
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'
  return {
    title: isEn ? 'Terms of Service — 파랑버섯 스튜디오' : '이용약관 — 파랑버섯 스튜디오',
    description: isEn ? '파랑버섯 스튜디오 card news studio terms of service' : '파랑버섯 스튜디오 서비스 이용약관',
    alternates: {
      canonical: `${base}/${locale}/terms`,
      languages: { ko: `${base}/ko/terms`, en: `${base}/en/terms` },
    },
    robots: { index: false, follow: false },
  }
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const authenticated = Boolean(await getSessionUser())
  const t = await getTranslations('terms')
  const isKo = locale === 'ko'

  return (
    <main className="min-h-screen bg-[#fbfaf7] text-[#171714]">
      <MarketingNav authenticated={authenticated} locale={locale} />
      <section className="mx-auto max-w-3xl px-5 py-20 md:px-8 md:py-28">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#847d73]">Terms</p>
        <h1 className="mt-5 text-4xl font-semibold md:text-5xl">{isKo ? '서비스 이용약관' : t('title')}</h1>
        {isKo ? (
          <div className="mt-10 space-y-9 text-sm leading-7 text-[#625c53]">
            <p>시행일: 2026년 6월</p>
            <p>
              본 이용약관은 파랑버섯 스튜디오가 제공하는 AI 기반 카드뉴스 및 SNS 콘텐츠 제작 서비스의 이용 조건과 회사와 이용자 간의 권리, 의무 및 책임사항을 규정합니다.
            </p>
            {koreanTermsSections.map(section => (
              <section key={section.title} className="space-y-4">
                <h2 className="text-base font-semibold text-[#171714]">{section.title}</h2>
                {section.paragraphs?.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                {section.orderedItems ? (
                  <ol className="list-decimal space-y-2 pl-5">
                    {section.orderedItems.map(item => <li key={item}>{item}</li>)}
                  </ol>
                ) : null}
                {section.items ? (
                  <ul className="list-disc space-y-1 pl-5">
                    {section.items.map(item => <li key={item}>{item}</li>)}
                  </ul>
                ) : null}
                {section.contact ? (
                  <div className="space-y-2">
                    <p>
                      이메일:{' '}
                      <a href="mailto:admin@shuffla.io" className="font-medium text-[#171714] hover:underline">
                        admin@shuffla.io
                      </a>
                    </p>
                    <p>
                      Instagram:{' '}
                      <a href="https://www.instagram.com/shuffla.io/" target="_blank" rel="noopener noreferrer" className="font-medium text-[#171714] hover:underline">
                        @shuffla.io
                      </a>
                    </p>
                    <p>공고일: 2026년 6월</p>
                    <p>시행일: 2026년 6월</p>
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        ) : (
          <div className="mt-10 space-y-8 text-sm leading-7 text-[#625c53]">
            <p className="text-xs text-[#847d73]">{t('effective')}</p>
            <section>
              <h2 className="text-base font-semibold text-[#171714]">{t('s1_title')}</h2>
              <p className="mt-3">{t('s1_body')}</p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-[#171714]">{t('s2_title')}</h2>
              <p className="mt-3">{t('s2_body')}</p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-[#171714]">{t('s3_title')}</h2>
              <p className="mt-3">{t('s3_body')}</p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-[#171714]">{t('s4_title')}</h2>
              <p className="mt-3">{t('s4_body')}</p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-[#171714]">{t('s5_title')}</h2>
              <p className="mt-3">{t('s5_body')}</p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-[#171714]">{t('s6_title')}</h2>
              <p className="mt-3">{t('s6_body')}</p>
              <div className="mt-4 flex gap-4">
                <a href="mailto:admin@shuffla.io" className="font-medium text-[#171714] hover:underline">admin@shuffla.io</a>
                <a href="https://www.instagram.com/shuffla.io/" target="_blank" rel="noopener noreferrer" className="font-medium text-[#171714] hover:underline">@shuffla.io</a>
              </div>
            </section>
            <section>
              <h2 className="text-base font-semibold text-[#171714]">{t('s7_title')}</h2>
              <p className="mt-3">{t('s7_body')}</p>
            </section>
          </div>
        )}
      </section>
      <MarketingFooter authenticated={authenticated} locale={locale} />
    </main>
  )
}
