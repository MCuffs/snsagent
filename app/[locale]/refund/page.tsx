import { MarketingNav } from '../../components/MarketingNav'
import { MarketingFooter } from '../../components/MarketingFooter'
import { getSessionUser } from '../../../lib/auth/user'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isEn = locale === 'en'
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'
  return {
    title: isEn ? 'Refund Policy | Shuffla' : '환불 정책 | Shuffla',
    description: isEn
      ? 'Shuffla refund and cancellation policy for subscription plans and one-time passes.'
      : 'Shuffla 구독 플랜 및 1회 이용권에 대한 환불 및 취소 정책입니다.',
    alternates: {
      canonical: `${base}/${locale}/refund`,
      languages: { ko: `${base}/ko/refund`, en: `${base}/en/refund` },
    },
  }
}

const KO_SECTIONS = [
  {
    title: '제1조 목적',
    body: '본 환불 정책은 파랑버섯 스튜디오(이하 "회사")가 운영하는 Shuffla 서비스(이하 "서비스")의 유료 결제에 대한 취소 및 환불 기준을 안내합니다.',
  },
  {
    title: '제2조 구독 플랜 취소 및 환불',
    items: [
      '유료 구독(Creator, Studio 플랜)은 월 단위로 자동 갱신됩니다.',
      '구독 취소는 서비스 내 [요금제] 메뉴 또는 고객 지원 이메일(admin@shuffla.io)을 통해 언제든지 신청할 수 있습니다.',
      '구독을 취소하면 즉시 유료 기능 이용이 중단됩니다. 이미 결제된 기간에 대한 부분 환불은 제공되지 않습니다.',
      '갱신일 이전에 취소하면 다음 결제 주기부터 청구되지 않습니다.',
      '단, 최초 결제일로부터 7일 이내에 서비스를 전혀 이용하지 않은 경우(카드뉴스 생성 0회) 전액 환불을 요청할 수 있습니다.',
    ],
  },
  {
    title: '제3조 환불이 불가한 경우',
    items: [
      '서비스를 이미 사용한 경우(카드뉴스 생성, 다운로드, 편집 등 기능 이용 이력이 있는 경우)',
      '결제일로부터 7일이 경과한 경우',
      '이용자의 약관 위반으로 인해 서비스 이용이 제한된 경우',
      '프로모션·할인 코드·이벤트를 통해 제공된 무료 이용권',
    ],
  },
  {
    title: '제4조 회사 귀책 사유에 의한 환불',
    body: '회사의 중대한 서비스 오류, 결제 시스템 오작동 등 회사 귀책 사유로 인해 서비스를 정상적으로 이용하지 못한 경우, 회사는 이용자에게 적절한 방법(전액 환불 또는 크레딧 지급)으로 보상합니다.',
  },
  {
    title: '제5조 환불 절차',
    items: [
      '환불을 요청하려면 admin@shuffla.io로 이메일을 보내주세요.',
      '이메일에 가입 계정 이메일 주소, 결제 일자, 환불 사유를 포함해 주세요.',
      '요청 접수 후 영업일 3일 이내에 검토 결과를 안내드립니다.',
      '환불이 승인된 경우, 결제 수단에 따라 카드사 처리 기간(영업일 3~7일)이 소요될 수 있습니다.',
    ],
  },
  {
    title: '제6조 정책 변경',
    body: '회사는 관련 법령 또는 서비스 운영 정책에 따라 본 환불 정책을 변경할 수 있습니다. 변경 시 서비스 내 공지 또는 이메일을 통해 사전 안내합니다.',
  },
  {
    title: '제7조 문의',
    body: '환불 관련 문의는 admin@shuffla.io로 연락해 주세요. 운영시간: 평일 10:00 ~ 18:00 (KST)',
    isContact: true,
  },
]

const EN_SECTIONS = [
  {
    title: 'Article 1 — Purpose',
    body: 'This Refund Policy describes the cancellation and refund terms for paid purchases made through Shuffla, operated by Parang Mushroom Studio ("Company").',
  },
  {
    title: 'Article 2 — Subscription Plan Cancellation & Refund',
    items: [
      'Paid subscriptions (Creator and Studio plans) renew automatically on a monthly basis.',
      'You may cancel your subscription at any time via the [Pricing] menu in the app or by emailing admin@shuffla.io.',
      'Upon cancellation, access to paid features stops immediately. No partial refunds are issued for the remaining period of an active billing cycle.',
      'Canceling before your renewal date prevents the next charge from occurring.',
      'Exception: if you cancel within 7 days of your first payment and have not used the service (0 card news generated), you may request a full refund.',
    ],
  },
  {
    title: 'Article 3 — Non-Refundable Cases',
    items: [
      'The service has been used (card news generated, downloaded, or edited)',
      'More than 7 days have passed since the payment date',
      'Access was restricted due to a violation of our Terms of Service',
      'Free credits provided through promotions, discount codes, or events',
    ],
  },
  {
    title: 'Article 4 — Refund Due to Company Error',
    body: 'If you are unable to use the service due to a material error or payment system failure on our part, the Company will provide appropriate compensation — either a full refund or equivalent service credit.',
  },
  {
    title: 'Article 5 — Refund Process',
    items: [
      'To request a refund, email us at admin@shuffla.io.',
      'Please include your account email address, payment date, and reason for the refund request.',
      'We will review your request and respond within 3 business days.',
      'Approved refunds are processed back to the original payment method. Processing time may take 3–7 business days depending on your card issuer.',
    ],
  },
  {
    title: 'Article 6 — Policy Updates',
    body: 'We may update this Refund Policy in accordance with applicable law or changes to our service. We will notify users in advance via in-app notice or email.',
  },
  {
    title: 'Article 7 — Contact',
    body: 'For refund inquiries, contact us at admin@shuffla.io. Support hours: Mon–Fri, 10:00–18:00 KST.',
    isContact: true,
  },
]

export default async function RefundPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isEn = locale === 'en'
  const user = await getSessionUser()
  const sections = isEn ? EN_SECTIONS : KO_SECTIONS
  const updatedAt = '2026-06-11'

  return (
    <div className="min-h-screen bg-[#fafaf7] text-[#0a0a0a]">
      <MarketingNav authenticated={!!user} locale={locale} />

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-24 md:px-8 md:pt-32">
        {/* Header */}
        <div className="mb-12 border-b border-black/[0.07] pb-8">
          <p className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-[#ff6b35]">
            {isEn ? 'Legal' : '법적 고지'}
          </p>
          <h1 className="text-[32px] font-black tracking-[-0.04em] md:text-[40px]">
            {isEn ? 'Refund Policy' : '환불 정책'}
          </h1>
          <p className="mt-3 text-sm text-[#8a8a8a]">
            {isEn ? `Last updated: ${updatedAt}` : `최종 수정일: ${updatedAt}`}
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-10">
          {sections.map((section, i) => (
            <section key={i}>
              <h2 className="mb-3 text-[15px] font-black text-[#0a0a0a]">{section.title}</h2>
              {section.body && (
                <p className="text-[14px] leading-[1.8] text-[#525252]">{section.body}</p>
              )}
              {section.items && (
                <ul className="mt-2 space-y-2">
                  {section.items.map((item, j) => (
                    <li key={j} className="flex gap-2.5 text-[14px] leading-[1.8] text-[#525252]">
                      <span className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff6b35]" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
              {section.isContact && (
                <p className="mt-3 text-[14px] text-[#525252]">
                  <a href="mailto:admin@shuffla.io" className="font-medium text-[#0a0a0a] underline underline-offset-2 hover:text-[#ff6b35]">
                    admin@shuffla.io
                  </a>
                </p>
              )}
            </section>
          ))}
        </div>
      </main>

      <MarketingFooter locale={locale} />
    </div>
  )
}
