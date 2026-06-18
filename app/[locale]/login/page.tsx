import Image from 'next/image'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
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
    <main
      className="min-h-screen"
      style={{ backgroundColor: '#f5f3ef' }}
    >
      {/* 상단 로고 */}
      <header className="flex h-14 items-center justify-between px-6 md:px-10">
        <Link href={`/${locale}`} className="flex items-center gap-2">
          <Image src="/shuffla-logo-mark.png" width={26} height={26} alt="Shuffla" />
          <span className="text-[17px] font-bold tracking-tight text-[#1a1a1a]">Shuffla</span>
        </Link>
        <Link
          href={`/${locale}`}
          className="flex items-center gap-1.5 text-sm text-[#6b6560] hover:text-[#1a1a1a] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {isEn ? 'Back' : '홈으로'}
        </Link>
      </header>

      {/* 본문 */}
      <div className="mx-auto grid min-h-[calc(100vh-56px)] max-w-[1200px] grid-cols-1 items-center gap-8 px-6 py-10 md:grid-cols-2 md:gap-16 md:px-10 lg:gap-24">

        {/* 좌측: 타이틀 + 폼 */}
        <div className="flex flex-col">
          <h1 className="mb-8 text-[38px] font-bold leading-[1.15] tracking-[-0.03em] text-[#1a1a1a] md:text-[44px]">
            {isEn ? (
              <>Think fast,<br />build faster</>
            ) : (
              <>빠르게 생각하고,<br />더 빠르게 구축하세요</>
            )}
          </h1>
          <p className="mb-8 text-[15px] text-[#6b6560]">
            {isEn
              ? 'AI card news, instantly. No design skills needed.'
              : 'AI로 카드뉴스를 즉시 생성하세요. 디자인 없이도 완성됩니다.'}
          </p>

          {/* 폼 카드 */}
          <div className="rounded-2xl bg-white p-7 shadow-[0_2px_20px_rgba(0,0,0,0.08)]">
            {errorMessage && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {errorMessage}
              </div>
            )}

            {/* Google 로그인 */}
            <Link
              href="/api/auth/google/start"
              prefetch={false}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#e0dbd5] bg-white text-[15px] font-medium text-[#1a1a1a] transition hover:bg-[#faf8f5] hover:border-[#ccc7c1]"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              {isEn ? 'Continue with Google' : 'Google로 계속하기'}
            </Link>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#e8e3de]" />
              <span className="text-xs text-[#a09990]">{isEn ? 'or' : '또는'}</span>
              <div className="h-px flex-1 bg-[#e8e3de]" />
            </div>

            {/* 이메일 로그인 탭 */}
            <LoginForm
              locale={locale}
              defaultTab={defaultTab}
              loginAction={handleLogin}
              registerAction={handleRegister}
            />
          </div>

          <p className="mt-4 text-center text-xs text-[#a09990]">
            {isEn
              ? 'No payment info required · 2 free card news'
              : '결제 정보 없이 가입 · 무료 2회 카드뉴스 즉시 생성'}
          </p>
        </div>

        {/* 우측: 이미지 */}
        <div className="hidden md:block">
          <div className="overflow-hidden rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
            <Image
              src="/login-showcase.png"
              alt="Shuffla preview"
              width={600}
              height={720}
              className="w-full object-cover"
              priority
            />
          </div>
        </div>
      </div>
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
