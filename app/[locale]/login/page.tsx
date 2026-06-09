import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getSessionUser, loginWithPasswordAction, registerAction } from '../../actions'
import { getTranslations } from 'next-intl/server'
import LoginForm from './LoginForm'

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
      description: isEn ? 'Start creating AI card news for your brand.' : 'AI 카드뉴스 제작을 시작하세요.',
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
  searchParams?: Promise<{ error?: string; from?: string; tab?: string }>
  params: Promise<{ locale: string }>
}) {
  const user = await getSessionUser()
  const { locale } = await params
  if (user) redirect(`/${locale}/concept`)

  const t = await getTranslations('login')
  const sp = searchParams ? await searchParams : {}
  const errorMessage = sp.error ? getLoginErrorMessage(sp.error, locale) : ''
  const fromCampaign = sp.from === 'campaign'
  const defaultTab = sp.tab === 'signup' ? 'signup' : 'login'
  const isEn = locale === 'en'

  async function handleLogin(formData: FormData) {
    'use server'
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const result = await loginWithPasswordAction(email, password)
    if (result.success) redirect(`/${locale}/concept`)
    redirect(`/${locale}/login?error=login_failed`)
  }

  async function handleRegister(formData: FormData) {
    'use server'
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const name = formData.get('name') as string
    const result = await registerAction(email, password, name)
    if (result.success) redirect(`/${locale}/concept`)
    redirect(`/${locale}/login?error=register_failed&tab=signup`)
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

      <section className="mx-auto grid min-h-[calc(100vh-76px)] max-w-[1320px] items-center gap-12 px-6 py-14 lg:grid-cols-[1fr_520px] lg:px-12">
        <div>
          <p className="mb-8 text-sm font-black uppercase tracking-[0.14em] text-[#746a62]">
            Shuffla Card News Studio
          </p>
          {fromCampaign ? (
            <>
              <h1 className="max-w-3xl whitespace-pre-line text-6xl font-black leading-[0.95] tracking-[-0.075em] md:text-7xl">
                {isEn ? 'Log in to view\nthis card news' : '카드뉴스를 보려면\n로그인하세요'}
              </h1>
              <p className="mt-7 max-w-2xl text-xl leading-8 text-[#332925]">
                {isEn ? 'Free plan included — 2 card news to create. No payment required.' : '무료 2회 생성 포함 — 결제 없이 바로 시작할 수 있어요.'}
              </p>
            </>
          ) : (
            <>
              <h1 className="max-w-3xl whitespace-pre-line text-6xl font-black leading-[0.95] tracking-[-0.075em] md:text-7xl">
                {t('title')}
              </h1>
              <p className="mt-7 max-w-2xl text-xl leading-8 text-[#332925]">
                {t('desc')}
              </p>
            </>
          )}
        </div>

        <div className="paper-noise rounded-[10px] bg-[#91a8c9] p-8 shadow-[0_34px_100px_rgba(57,69,90,0.22)]">
          <div className="rounded-[8px] border border-[#e8dfd4] bg-[#fffdf8] p-8 shadow-[0_18px_50px_rgba(31,21,18,0.12)]">
            {errorMessage && (
              <div className="mb-5 rounded-[5px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
                {errorMessage}
              </div>
            )}

            {/* Google 로그인 */}
            <Link
              href="/api/auth/google/start"
              prefetch={false}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-[5px] border border-[#7d756c] bg-white text-base font-bold transition hover:bg-[#fff8f0]"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full border border-[#dadce0] bg-white text-sm font-black text-[#4285f4]">
                G
              </span>
              {isEn ? 'Continue with Google' : 'Google로 로그인'}
            </Link>

            <div className="my-6 flex items-center gap-4 text-xs font-bold text-[#a29a91]">
              <div className="h-px flex-1 bg-[#e8dfd4]" />
              {isEn ? 'or use email' : '또는 이메일로'}
              <div className="h-px flex-1 bg-[#e8dfd4]" />
            </div>

            {/* 로그인 / 신규 가입 탭 */}
            <LoginForm
              locale={locale}
              defaultTab={defaultTab}
              loginAction={handleLogin}
              registerAction={handleRegister}
            />

            <p className="mt-5 text-center text-xs text-[#a29a91]">
              {isEn ? 'No payment info required · 2 free card news · Cancel anytime' : '결제 정보 없이 가입 · 무료 2회 카드뉴스 즉시 생성 · 언제든 탈퇴 가능'}
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

function getLoginErrorMessage(error: string, locale: string) {
  const isEn = locale === 'en'
  const map: Record<string, string> = {
    login_failed: isEn ? 'Incorrect email or password.' : '이메일 또는 비밀번호가 올바르지 않습니다.',
    register_failed: isEn ? 'This email is already registered. Please log in.' : '이미 가입된 이메일입니다. 로그인해 주세요.',
    google_callback_invalid: isEn ? 'Invalid Google login response.' : 'Google 로그인 응답이 올바르지 않습니다.',
    google_state_invalid: isEn ? 'Google login security check failed.' : 'Google 로그인 보안 검증에 실패했습니다.',
    google_oauth_failed: isEn ? 'An error occurred during Google login.' : 'Google 로그인 처리 중 오류가 발생했습니다.',
    access_denied: isEn ? 'Login was canceled.' : '로그인이 취소되었습니다.',
  }
  return map[error] || (isEn ? 'An error occurred. Please try again.' : '오류가 발생했습니다. 다시 시도해 주세요.')
}
