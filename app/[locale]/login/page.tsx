import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { ArrowLeft, ArrowRight, Mail, ShieldCheck } from 'lucide-react'
import { getSessionUser, loginAction } from '../../actions'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isEn = locale === 'en'
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'
  return {
    title: isEn ? 'Log in — Shuffla Card News Studio' : '로그인 — Shuffla 카드뉴스 스튜디오',
    description: isEn
      ? 'Log in to Shuffla to start creating AI-powered card news for your brand.'
      : 'Shuffla에 로그인하고 AI 카드뉴스 제작을 시작하세요.',
    alternates: {
      canonical: `${base}/${locale}/login`,
      languages: { ko: `${base}/ko/login`, en: `${base}/en/login` },
    },
    openGraph: {
      title: isEn ? 'Log in — Shuffla' : '로그인 — Shuffla',
      description: isEn
        ? 'Start creating AI card news for your brand.'
        : 'AI 카드뉴스 제작을 시작하세요.',
      url: `${base}/${locale}/login`,
      type: 'website',
      siteName: 'Shuffla',
      images: [{ url: `${base}/og-image.png`, width: 1200, height: 630, alt: 'Shuffla' }],
    },
    robots: { index: false, follow: false },
  }
}

export default async function LoginPage({
  searchParams,
  params,
}: {
  searchParams?: Promise<{ error?: string }>
  params: Promise<{ locale: string }>
}) {
  const user = await getSessionUser()
  const { locale } = await params
  if (user) {
    redirect(`/${locale}/concept`)
  }

  const t = await getTranslations('login')
  const sp = searchParams ? await searchParams : {}
  const errorMessage = sp.error ? getLoginErrorMessage(sp.error, locale) : ''

  async function handleSubmit(formData: FormData) {
    'use server'
    const email = formData.get('email') as string
    const name = formData.get('name') as string
    const result = await loginAction(email, name)
    if (result.success) {
      redirect(`/${locale}/concept`)
    }
  }

  async function handleDemoLogin() {
    'use server'
    const demoEmail = process.env.NEXT_PUBLIC_DEMO_USER_EMAIL || 'demo@shuffla.ai'
    const result = await loginAction(demoEmail, 'Demo User')
    if (result.success) {
      redirect(`/${locale}/concept`)
    }
  }

  return (
    <main className="app-shell min-h-screen text-[#1f1512]">
      <header className="flex h-[76px] items-center justify-between border-b border-[#ece2d6] bg-[#fffdf8]/88 px-6 backdrop-blur-xl lg:px-12">
        <Link href={`/${locale}`} className="flex items-center gap-2 text-2xl font-black tracking-[-0.05em]">
          <Image src="/shuffla-logo-mark.png" width={34} height={34} alt="Shuffla 로고" />
          Shuffla
        </Link>
        <Link href={`/${locale}`} className="flex items-center gap-2 text-sm font-black text-[#1f1512]">
          <ArrowLeft className="h-4 w-4" />
          {t('back_home')}
        </Link>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-76px)] max-w-[1320px] items-center gap-12 px-6 py-14 lg:grid-cols-[1fr_560px] lg:px-12">
        <div>
          <p className="mb-8 text-sm font-black uppercase tracking-[0.14em] text-[#746a62]">
            Shuffla Card News Studio
          </p>
          <h1 className="max-w-3xl whitespace-pre-line text-6xl font-black leading-[0.95] tracking-[-0.075em] md:text-7xl">
            {t('title')}
          </h1>
          <p className="mt-7 max-w-2xl text-xl leading-8 text-[#332925]">
            {t('desc')}
          </p>
        </div>

        <div className="paper-noise rounded-[10px] bg-[#91a8c9] p-8 shadow-[0_34px_100px_rgba(57,69,90,0.22)]">
          <div className="rounded-[8px] border border-[#e8dfd4] bg-[#fffdf8] p-8 shadow-[0_18px_50px_rgba(31,21,18,0.12)]">
            {errorMessage && (
              <div className="mb-5 rounded-[5px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
                {errorMessage}
              </div>
            )}

            <Link
              href="/api/auth/google/start"
              prefetch={false}
              className="mb-7 flex h-14 w-full items-center justify-center gap-3 rounded-[5px] border border-[#7d756c] bg-white text-lg font-black transition hover:bg-[#fff8f0]"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full border border-[#dadce0] bg-white text-base font-black text-[#4285f4]">
                G
              </span>
              {t('google_cta')}
            </Link>

            {process.env.NODE_ENV !== 'production' && (
              <>
                <div className="mb-7 flex items-center gap-5 text-sm font-bold text-[#a29a91]">
                  <div className="h-px flex-1 bg-[#e8dfd4]" />
                  {locale === 'en' ? 'or' : '또는'}
                  <div className="h-px flex-1 bg-[#e8dfd4]" />
                </div>

                <form action={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="email" className="mb-2 block text-sm font-black">
                      {t('email_label')}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#746a62]" />
                      <input
                        id="email"
                        name="email"
                        type="email"
                        placeholder={t('email_placeholder')}
                        required
                        className="field h-14 pl-11 pr-4 text-base"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="name" className="mb-2 block text-sm font-black">
                      {t('name_label')}
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      placeholder={t('name_placeholder')}
                      className="field h-14 px-4 text-base"
                    />
                  </div>

                  <button type="submit" className="btn-primary w-full rounded-[5px] text-lg">
                    {t('email_cta')}
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </form>

                <form action={handleDemoLogin} className="mt-4">
                  <button type="submit" className="btn-secondary w-full rounded-[5px]">
                    <ShieldCheck className="h-4 w-4 text-[#ff4f0a]" />
                    {t('demo_cta')}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

function getLoginErrorMessage(error: string, locale: string) {
  const isEn = locale === 'en'
  const map: Record<string, string> = {
    google_config_missing: isEn
      ? 'Google OAuth environment variables are missing. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env and restart the dev server.'
      : 'Google OAuth 환경변수가 없습니다. .env에 GOOGLE_CLIENT_ID와 GOOGLE_CLIENT_SECRET을 입력한 뒤 dev 서버를 재시작하세요.',
    google_callback_invalid: isEn
      ? 'Invalid Google login response.'
      : 'Google 로그인 응답이 올바르지 않습니다.',
    google_state_invalid: isEn
      ? 'Google login security check failed. Please try again.'
      : 'Google 로그인 보안 검증에 실패했습니다. 다시 시도하세요.',
    google_oauth_failed: isEn
      ? 'An error occurred during Google login.'
      : 'Google 로그인 처리 중 오류가 발생했습니다.',
    database_unavailable: isEn
      ? 'Login succeeded but the database is unavailable. Check your DATABASE_URL and restart the dev server.'
      : '로그인은 완료됐지만 데이터베이스에 연결할 수 없습니다.',
    access_denied: isEn ? 'Google login was canceled.' : 'Google 로그인이 취소되었습니다.',
  }
  return map[error] || (isEn ? 'An error occurred during login.' : '로그인 중 오류가 발생했습니다.')
}
