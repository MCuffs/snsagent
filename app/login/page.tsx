import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ArrowRight, Mail, ShieldCheck } from 'lucide-react'
import { getSessionUser, loginAction } from '../actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  const user = await getSessionUser()
  if (user) {
    redirect('/brand?start=1')
  }

  const params = searchParams ? await searchParams : {}
  const errorMessage = params.error ? getLoginErrorMessage(params.error) : ''

  async function handleSubmit(formData: FormData) {
    'use server'

    const email = formData.get('email') as string
    const name = formData.get('name') as string
    const result = await loginAction(email, name)
    if (result.success) {
      redirect('/brand?start=1')
    }
  }

  async function handleDemoLogin() {
    'use server'

    const demoEmail = process.env.NEXT_PUBLIC_DEMO_USER_EMAIL || 'demo@shuffla.ai'
    const result = await loginAction(demoEmail, 'Demo User')
    if (result.success) {
      redirect('/brand?start=1')
    }
  }

  return (
    <main className="app-shell min-h-screen text-[#1f1512]">
      <header className="flex h-[76px] items-center justify-between border-b border-[#ece2d6] bg-[#fffdf8]/88 px-6 backdrop-blur-xl lg:px-12">
        <Link href="/" className="flex items-center gap-2 text-2xl font-black tracking-[-0.05em]">
          <span className="h-1.5 w-7 rounded-full bg-[#ff4f0a]" />
          Shuffla
        </Link>
        <Link href="/" className="flex items-center gap-2 text-sm font-black text-[#1f1512]">
          <ArrowLeft className="h-4 w-4" />
          메인으로
        </Link>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-76px)] max-w-[1320px] items-center gap-12 px-6 py-14 lg:grid-cols-[1fr_560px] lg:px-12">
        <div>
          <p className="mb-8 text-sm font-black uppercase tracking-[0.14em] text-[#746a62]">
            Shuffla Card News Studio
          </p>
          <h1 className="max-w-3xl text-6xl font-black leading-[0.95] tracking-[-0.075em] md:text-7xl">
            카드뉴스 제작을 바로 시작하세요
          </h1>
          <p className="mt-7 max-w-2xl text-xl leading-8 text-[#332925]">
            Google 계정으로 로그인하면 브랜드 설정, 카드뉴스 생성, 편집, 다운로드 작업을 한 곳에서 이어갈 수 있습니다.
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
              Google로 계속하기
            </Link>

            <div className="mb-7 flex items-center gap-5 text-sm font-bold text-[#a29a91]">
              <div className="h-px flex-1 bg-[#e8dfd4]" />
              또는
              <div className="h-px flex-1 bg-[#e8dfd4]" />
            </div>

            <form action={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-black">
                  이메일 *
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#746a62]" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@company.com"
                    required
                    className="field h-14 pl-11 pr-4 text-base"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-black">
                  이름 또는 브랜드명
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="예: Daily Mocha"
                  className="field h-14 px-4 text-base"
                />
              </div>

              <p className="text-sm leading-6 text-[#4a4039]">
                이메일 로그인은 로컬 테스트용입니다. 실제 운영에서는 Google 로그인을 기본 진입 방식으로 사용합니다.
              </p>

              <button type="submit" className="btn-primary w-full rounded-[5px] text-lg">
                이메일로 시작하기
                <ArrowRight className="h-5 w-5" />
              </button>
            </form>

            <form action={handleDemoLogin} className="mt-4">
              <button type="submit" className="btn-secondary w-full rounded-[5px]">
                <ShieldCheck className="h-4 w-4 text-[#ff4f0a]" />
                데모 계정으로 입장
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  )
}

function getLoginErrorMessage(error: string) {
  const map: Record<string, string> = {
    google_config_missing: 'Google OAuth 환경변수가 설정되지 않았습니다. GOOGLE_CLIENT_ID와 GOOGLE_CLIENT_SECRET을 입력하세요.',
    google_callback_invalid: 'Google 로그인 응답이 올바르지 않습니다.',
    google_state_invalid: 'Google 로그인 보안 검증에 실패했습니다. 다시 시도하세요.',
    google_oauth_failed: 'Google 로그인 처리 중 오류가 발생했습니다.',
    access_denied: 'Google 로그인이 취소되었습니다.',
  }

  return map[error] || '로그인 중 오류가 발생했습니다.'
}
