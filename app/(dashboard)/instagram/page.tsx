import { redirect } from 'next/navigation'
import { CheckCircle2, ExternalLink, KeyRound, ShieldAlert, Zap } from 'lucide-react'
import { getSessionUser, quickConnectInstagramAction, saveInstagramAccountAction } from '../../actions'
import InstagramIcon from '../../components/InstagramIcon'
import { dbService } from '../../../lib/db-service'
import { getMetaAppId, isInstagramMockMode } from '../../../lib/env'
import { tokenEncryptor } from '../../../lib/instagram/client'

export const dynamic = 'force-dynamic'

export default async function InstagramSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ connected?: string; error?: string }>
}) {
  const user = await getSessionUser()
  if (!user) return null

  const brands = await dbService.getBrands(user.id)
  if (brands.length === 0) {
    redirect('/brand')
  }

  const brand = brands[0]
  const account = await dbService.getInstagramAccount(user.id, brand.id)
  const decryptedToken = account ? safeDecryptToken(account.accessTokenEncrypted) : ''
  const mockMode = isInstagramMockMode()
  const oauthConfigured = Boolean(getMetaAppId())
  const params = searchParams ? await searchParams : {}

  async function handleSubmit(formData: FormData) {
    'use server'
    const result = await saveInstagramAccountAction(
      brand.id,
      formData.get('accountId') as string,
      formData.get('accessToken') as string
    )
    if (result.success) {
      redirect('/dashboard')
    }
  }

  async function handleQuickConnect() {
    'use server'
    const result = await quickConnectInstagramAction(brand.id)
    if (result.success) {
      redirect('/dashboard')
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8">
      <div className="mb-8">
        <p className="eyebrow">Instagram</p>
        <div className="mt-3 flex items-start gap-3">
          <InstagramIcon className="mt-1 h-6 w-6 text-[#b94718]" />
          <div>
            <h1 className="text-3xl font-black tracking-tight text-neutral-950">인스타그램 연결</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f6a61]">
              데모에서는 빠른 연결로 발행 흐름을 확인하고, 운영 환경에서는 Meta OAuth 또는 Graph API 토큰을 사용합니다.
            </p>
          </div>
        </div>
      </div>

      {params.connected === 'meta' && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
          Meta OAuth 연결이 완료되었습니다.
        </div>
      )}
      {params.error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          {getMetaErrorMessage(params.error)}
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {mockMode && (
          <form action={handleQuickConnect} className="panel rounded-lg p-6">
            <Zap className="h-5 w-5 text-[#b94718]" />
            <h2 className="mt-4 text-lg font-black tracking-tight text-neutral-950">데모 빠른 연결</h2>
            <p className="mt-2 text-sm leading-6 text-[#6f6a61]">
              Meta 설정 없이 mock 계정을 연결해 승인, 예약, 게시 완료 흐름을 테스트합니다.
            </p>
            <button type="submit" className="btn-primary mt-6 w-full px-4">
              1초 연결
            </button>
          </form>
        )}

        <div className="panel rounded-lg p-6">
          <ExternalLink className="h-5 w-5 text-[#b94718]" />
          <h2 className="mt-4 text-lg font-black tracking-tight text-neutral-950">Meta OAuth 연결</h2>
          <p className="mt-2 text-sm leading-6 text-[#6f6a61]">
            Instagram Business 계정과 연결된 Facebook Page를 자동으로 찾아 저장합니다.
          </p>
          <a
            href={oauthConfigured ? `/api/auth/meta/start?brandId=${brand.id}` : '#'}
            aria-disabled={!oauthConfigured}
            className={oauthConfigured ? 'btn-primary mt-6 w-full px-4' : 'btn-secondary mt-6 w-full px-4 opacity-60'}
          >
            {oauthConfigured ? 'OAuth로 연결' : 'Meta 설정 필요'}
          </a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <form action={handleSubmit} className="panel rounded-lg p-6 md:p-8">
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-[#dedbd2] bg-[#f1f0eb]/70 px-4 py-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#b94718]" />
            <p className="text-xs leading-5 text-[#6f6a61]">
              Access Token은 서버에서 암호화되어 저장됩니다. 운영 계정에는 필요한 최소 권한만 부여하세요.
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label htmlFor="accountId" className="mb-2 block text-xs font-bold text-[#5d584f]">
                Instagram Business Account ID
              </label>
              <input
                id="accountId"
                name="accountId"
                type="text"
                required={!mockMode}
                placeholder={mockMode ? '데모에서는 비워도 됩니다.' : '예: 17841401234567890'}
                defaultValue={account?.instagramAccountId || ''}
                className="field h-11 px-3"
              />
            </div>

            <div>
              <label htmlFor="accessToken" className="mb-2 block text-xs font-bold text-[#5d584f]">
                Meta Graph API Access Token
              </label>
              <input
                id="accessToken"
                name="accessToken"
                type="password"
                required={!mockMode}
                placeholder={decryptedToken ? '저장된 토큰 사용 중' : 'EAAG...'}
                defaultValue={decryptedToken}
                className="field h-11 px-3"
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end border-t border-[#ece9e0] pt-6">
            <button type="submit" className="btn-primary px-5">
              <KeyRound className="h-4 w-4" />
              연결 정보 저장
            </button>
          </div>
        </form>

        <aside className="panel-muted rounded-lg p-6">
          <p className="eyebrow">Status</p>
          <div className="mt-6 flex items-center gap-3">
            <CheckCircle2 className={`h-6 w-6 ${account?.status === 'CONNECTED' ? 'text-emerald-600' : 'text-[#aaa49a]'}`} />
            <div>
              <p className="text-sm font-black text-neutral-950">
                {account?.status === 'CONNECTED' ? '연결됨' : '미연결'}
              </p>
              <p className="mt-1 text-xs text-[#6f6a61]">
                {account?.instagramAccountId || '계정 정보 없음'}
              </p>
            </div>
          </div>
          <div className="mt-6 border-t border-[#dedbd2] pt-5 text-xs leading-5 text-[#6f6a61]">
            브랜드: <strong className="text-neutral-950">{brand.name}</strong>
          </div>
        </aside>
      </div>
    </div>
  )
}

function safeDecryptToken(encryptedToken: string) {
  try {
    return tokenEncryptor.decrypt(encryptedToken)
  } catch {
    return ''
  }
}

function getMetaErrorMessage(error: string) {
  const map: Record<string, string> = {
    meta_config_missing: 'Meta 앱 설정이 필요합니다.',
    meta_callback_invalid: 'Meta callback 요청이 올바르지 않습니다.',
    meta_state_invalid: 'OAuth state 검증에 실패했습니다.',
    brand_forbidden: '브랜드 접근 권한이 없습니다.',
    no_instagram_business_account: '연결 가능한 Instagram Business 계정을 찾지 못했습니다.',
    meta_oauth_failed: 'Meta OAuth 연결에 실패했습니다.',
  }
  return map[error] || 'Instagram 연결 중 오류가 발생했습니다.'
}
