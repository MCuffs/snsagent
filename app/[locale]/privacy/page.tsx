import { MarketingFooter } from '../../components/MarketingFooter'
import { MarketingNav } from '../../components/MarketingNav'
import { getSessionUser } from '../../../lib/auth/user'
import { getTranslations } from 'next-intl/server'

const koreanPolicySections = [
  {
    title: '1. 수집하는 개인정보',
    body: [
      {
        subtitle: '회원 및 계정 정보',
        items: [
          '이메일 주소',
          '이름 또는 닉네임',
          '프로필 이미지',
          'Google OAuth 등 소셜 로그인 식별 정보',
        ],
      },
      {
        subtitle: '서비스 이용 정보',
        items: [
          '브랜드명, 브랜드 소개, 톤앤매너, 컬러, 로고 등 브랜드 설정 정보',
          '이용자가 입력한 주제, 키워드, 프롬프트, 요청 내용',
          'AI 생성 결과, 편집 결과, 작업 히스토리',
          '업로드한 이미지, 로고, 참고자료, 콘텐츠 파일',
          '플랜 정보, 사용량, 생성 횟수',
          '문의 내용 및 고객지원 기록',
        ],
      },
      {
        subtitle: '결제 관련 정보',
        paragraphs: [
          '파랑버섯 스튜디오는 카드번호, CVC, 계좌번호 등 직접적인 결제수단 정보를 저장하지 않습니다. 결제는 외부 결제 제공자를 통해 처리됩니다.',
          '회사는 결제 상태, 구독 플랜, 결제 제공자, 결제 식별자, 환불 또는 결제 취소 상태 등 서비스 운영에 필요한 최소한의 결제 관련 정보만 저장할 수 있습니다.',
        ],
      },
      {
        subtitle: '자동 수집 정보',
        paragraphs: [
          '서비스 이용 과정에서 IP 주소, 브라우저 및 기기 정보, 접속 일시, 서비스 이용 기록, 오류 로그, 쿠키 정보가 자동으로 수집될 수 있습니다.',
        ],
      },
    ],
  },
  {
    title: '2. 개인정보의 이용 목적',
    paragraphs: [
      '파랑버섯 스튜디오는 수집한 개인정보를 다음 목적으로 이용합니다.',
    ],
    items: [
      '회원 가입, 로그인 및 계정 관리',
      'AI 카드뉴스 및 SNS 콘텐츠 생성',
      '브랜드 프로필 저장 및 맞춤형 생성 결과 제공',
      '작업 히스토리 저장 및 파일 관리',
      '구독 플랜, 결제 상태, 사용량 확인',
      '고객 문의 응대 및 공지 전달',
      '서비스 오류 분석, 보안, 부정 이용 방지',
      '서비스 품질 개선 및 기능 고도화',
      '법령상 의무 이행 및 분쟁 대응',
    ],
    after: '파랑버섯 스튜디오는 이용자의 개인정보를 마케팅 목적으로 제3자에게 판매하지 않습니다.',
  },
  {
    title: '3. 개인정보의 보유 및 이용 기간',
    paragraphs: [
      '파랑버섯 스튜디오는 개인정보의 수집 및 이용 목적이 달성되면 해당 정보를 지체 없이 삭제합니다. 다만, 서비스 운영 및 관련 법령에 따라 필요한 정보는 일정 기간 보관할 수 있습니다.',
    ],
    body: [
      {
        subtitle: '계정 정보',
        items: [
          '보유 기간: 회원 탈퇴 시까지',
          '보유 목적: 회원 식별, 로그인, 계정 관리',
        ],
      },
      {
        subtitle: '작업 히스토리 및 생성 결과물',
        paragraphs: ['플랜에 따라 다음 기간 동안 보관될 수 있습니다.'],
        items: [
          'Free 플랜: 30일',
          'Creator 플랜: 90일',
          'Studio 플랜: 365일',
        ],
      },
      {
        subtitle: '결제 및 구독 기록',
        paragraphs: [
          '전자상거래 등 관련 법령에 따라 결제 및 구독 관련 기록은 최대 5년간 보관될 수 있습니다.',
        ],
      },
      {
        subtitle: '접속 기록',
        paragraphs: [
          '통신비밀보호법에 따라 접속 기록은 3개월간 보관될 수 있습니다.',
        ],
      },
    ],
  },
  {
    title: '4. 개인정보의 제3자 제공',
    paragraphs: [
      '파랑버섯 스튜디오는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 다음의 경우에는 예외적으로 제공될 수 있습니다.',
    ],
    items: [
      '이용자가 사전에 동의한 경우',
      '법령에 따라 요청받은 경우',
      '수사기관 또는 관계기관이 적법한 절차에 따라 요청한 경우',
      '서비스 제공을 위해 외부 서비스 연동 또는 처리 위탁이 필요한 경우',
    ],
  },
  {
    title: '5. 개인정보 처리 위탁 및 외부 서비스 이용',
    paragraphs: [
      '파랑버섯 스튜디오는 원활한 서비스 제공을 위해 다음 외부 서비스를 이용할 수 있습니다. 각 외부 서비스에는 서비스 제공에 필요한 최소한의 정보만 전달됩니다.',
    ],
    table: [
      ['Google OAuth', '소셜 로그인 및 계정 인증'],
      ['OpenAI', 'AI 콘텐츠 생성 요청 처리'],
      ['Google Gemini', 'AI 콘텐츠 생성 요청 처리'],
      ['Vercel', '서비스 호스팅'],
      ['Vercel Blob', '이미지, 파일, 생성 결과물 저장'],
      ['토스페이먼츠, 나이스페이, PayPal', '결제 처리'],
      ['이메일 발송 서비스', '인증 메일, 안내 메일, 알림 발송'],
      ['분석 및 오류 모니터링 도구', '서비스 개선, 장애 대응, 보안 로그 분석'],
    ],
    after: '일부 외부 서비스는 해외 사업자가 제공할 수 있으며, 이 경우 서비스 제공에 필요한 최소한의 정보가 해당 제공자의 처리 환경에서 처리될 수 있습니다. 외부 서비스 또는 위탁 내용이 변경되는 경우 본 개인정보처리방침을 통해 안내합니다.',
  },
  {
    title: '6. AI 생성 기능 이용 시 개인정보 처리',
    paragraphs: [
      '파랑버섯 스튜디오는 이용자가 입력한 주제, 키워드, 브랜드 정보, 업로드 이미지, 참고자료 등을 바탕으로 AI 콘텐츠를 생성합니다.',
      'AI 생성 기능 이용 시 콘텐츠 생성에 필요한 입력 정보가 OpenAI, Google Gemini 등 외부 AI 모델 제공자에게 전달될 수 있습니다.',
      '이용자는 주민등록번호, 여권번호, 카드번호, 계좌번호, 비밀번호, 건강정보 등 불필요한 개인정보나 민감한 정보를 프롬프트 또는 업로드 파일에 입력하지 않아야 합니다.',
    ],
  },
  {
    title: '7. 쿠키 및 자동 수집 정보',
    paragraphs: [
      '파랑버섯 스튜디오는 로그인 유지, 사용자 설정 저장, 서비스 이용 분석, 오류 확인, 부정 이용 방지를 위해 쿠키 또는 유사 기술을 사용할 수 있습니다.',
      '이용자는 브라우저 설정을 통해 쿠키 저장을 거부하거나 삭제할 수 있습니다. 다만, 쿠키를 거부하는 경우 로그인, 작업 저장 등 일부 기능 이용이 제한될 수 있습니다.',
    ],
  },
  {
    title: '8. 개인정보의 삭제 및 파기',
    paragraphs: [
      '파랑버섯 스튜디오는 개인정보의 보유 기간이 지나거나 처리 목적이 달성된 경우 해당 정보를 삭제합니다.',
      '전자적 파일은 복구하기 어려운 방식으로 삭제하며, 데이터베이스 기록은 내부 기준에 따라 삭제 또는 분리 보관합니다. 법령에 따라 보관해야 하는 정보는 해당 기간 동안 별도로 보관하고, 다른 목적으로 이용하지 않습니다.',
    ],
  },
  {
    title: '9. 이용자의 권리',
    paragraphs: [
      '이용자는 언제든지 본인의 개인정보에 대해 열람, 수정, 삭제, 처리정지, 회원 탈퇴를 요청할 수 있습니다.',
      '요청은 아래 문의처를 통해 접수할 수 있으며, 파랑버섯 스튜디오는 본인 확인 후 관련 법령에 따라 처리합니다.',
      '다만, 법령상 보관 의무가 있거나 부정 이용 방지, 분쟁 대응을 위해 필요한 경우 일부 정보의 삭제가 제한될 수 있습니다.',
    ],
  },
  {
    title: '10. 14세 미만 아동의 개인정보',
    paragraphs: [
      '파랑버섯 스튜디오는 원칙적으로 만 14세 미만 아동의 회원가입 및 서비스 이용을 허용하지 않습니다.',
      '만 14세 미만 아동의 개인정보가 법정대리인의 동의 없이 수집된 사실을 확인한 경우, 해당 정보를 지체 없이 삭제합니다.',
    ],
  },
  {
    title: '11. 개인정보의 안전성 확보 조치',
    paragraphs: [
      '파랑버섯 스튜디오는 개인정보 보호를 위해 다음과 같은 조치를 적용합니다.',
    ],
    items: [
      '개인정보 접근 권한 최소화',
      '관리자 계정 접근 통제',
      'HTTPS 등 암호화 통신 적용',
      '서버 및 저장소 접근 제한',
      '서비스 로그 모니터링',
      '외부 서비스 연동 시 필요한 최소 정보만 전송',
    ],
  },
  {
    title: '12. 개인정보 문의',
    paragraphs: [
      '개인정보 관련 문의, 열람, 수정, 삭제, 탈퇴 요청은 아래 연락처로 문의할 수 있습니다.',
    ],
    contact: true,
  },
  {
    title: '13. 개인정보처리방침 변경',
    paragraphs: [
      '본 개인정보처리방침은 법령, 서비스 내용, 외부 서비스 연동, 내부 운영 정책의 변경에 따라 수정될 수 있습니다.',
      '내용이 변경되는 경우 파랑버섯 스튜디오는 서비스 내 공지 또는 웹사이트를 통해 안내합니다.',
      '공고일: 2026년 6월',
      '시행일: 2026년 6월',
    ],
  },
]

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isEn = locale === 'en'
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'
  return {
    title: isEn ? 'Privacy Policy — 파랑버섯 스튜디오' : '개인정보 처리방침 — 파랑버섯 스튜디오',
    description: isEn ? '파랑버섯 스튜디오 card news studio privacy policy' : '파랑버섯 스튜디오 카드뉴스 스튜디오 개인정보 처리방침',
    alternates: {
      canonical: `${base}/${locale}/privacy`,
      languages: { ko: `${base}/ko/privacy`, en: `${base}/en/privacy` },
    },
    robots: { index: false, follow: false },
  }
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const authenticated = Boolean(await getSessionUser())
  const t = await getTranslations('privacy')
  const isKo = locale === 'ko'

  return (
    <main className="min-h-screen bg-[#fbfaf7] text-[#171714]">
      <MarketingNav authenticated={authenticated} locale={locale} />
      <section className="mx-auto max-w-3xl px-5 py-20 md:px-8 md:py-28">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#847d73]">Privacy</p>
        <h1 className="mt-5 text-4xl font-semibold md:text-5xl">{isKo ? '개인정보처리방침' : t('title')}</h1>
        {isKo ? (
          <div className="mt-10 space-y-9 text-sm leading-7 text-[#625c53]">
            <p>
              시행일: 2026년 6월
            </p>
            <p>
              파랑버섯 스튜디오는 이용자의 개인정보를 중요하게 생각하며, 관련 법령에 따라 개인정보를 안전하게 처리합니다.
              본 개인정보처리방침은 파랑버섯 스튜디오가 제공하는 AI 기반 카드뉴스 및 SNS 콘텐츠 생성 서비스에서 개인정보를 어떻게 수집, 이용, 보관, 위탁 및 삭제하는지 안내합니다.
            </p>
            {koreanPolicySections.map(section => (
              <section key={section.title} className="space-y-4">
                <h2 className="text-base font-semibold text-[#171714]">{section.title}</h2>
                {section.paragraphs?.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                {section.items ? (
                  <ul className="list-disc space-y-1 pl-5">
                    {section.items.map(item => <li key={item}>{item}</li>)}
                  </ul>
                ) : null}
                {section.body?.map(block => (
                  <div key={block.subtitle} className="space-y-2">
                    <h3 className="font-semibold text-[#2b2924]">{block.subtitle}</h3>
                    {block.paragraphs?.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                    {block.items ? (
                      <ul className="list-disc space-y-1 pl-5">
                        {block.items.map(item => <li key={item}>{item}</li>)}
                      </ul>
                    ) : null}
                  </div>
                ))}
                {section.table ? (
                  <div className="overflow-hidden rounded border border-[#e3ded4]">
                    <table className="w-full border-collapse text-left text-xs md:text-sm">
                      <thead className="bg-[#f2eee6] text-[#171714]">
                        <tr>
                          <th className="border-b border-[#e3ded4] px-4 py-3 font-semibold">제공자</th>
                          <th className="border-b border-[#e3ded4] px-4 py-3 font-semibold">이용 목적</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.table.map(([provider, purpose]) => (
                          <tr key={provider} className="border-b border-[#eee9df] last:border-0">
                            <td className="px-4 py-3 font-medium text-[#2b2924]">{provider}</td>
                            <td className="px-4 py-3">{purpose}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
                    <p>개인정보보호 책임자</p>
                    <p>성명: 정민수</p>
                    <p>
                      이메일:{' '}
                      <a href="mailto:admin@shuffla.io" className="font-medium text-[#171714] hover:underline">
                        admin@shuffla.io
                      </a>
                    </p>
                  </div>
                ) : null}
                {section.after ? <p>{section.after}</p> : null}
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
          </div>
        )}
      </section>
      <MarketingFooter authenticated={authenticated} locale={locale} />
    </main>
  )
}
