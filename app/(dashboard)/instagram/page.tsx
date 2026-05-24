import { redirect } from 'next/navigation'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { getSessionUser } from '../../actions'
import InstagramIcon from '../../components/InstagramIcon'
import { dbService } from '../../../lib/db-service'
import { getMetaAppId } from '../../../lib/env'

export const dynamic = 'force-dynamic'

export default async function InstagramSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ connected?: string; error?: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const brands = await dbService.getBrands(user.id)
  if (brands.length === 0) {
    redirect('/brand')
  }

  const brand = brands[0]
  const account = await dbService.getInstagramAccount(user.id, brand.id)
  const oauthConfigured = Boolean(getMetaAppId())
  const params = searchParams ? await searchParams : {}
  const isConnected = account?.status === 'CONNECTED'

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 md:px-8">
      <div className="mb-8">
        <p className="eyebrow">Instagram</p>
        <div className="mt-3 flex items-start gap-3">
          <InstagramIcon className="mt-1 h-6 w-6 text-[#b94718]" />
          <div>
            <h1 className="text-3xl font-black tracking-tight text-neutral-950">인스타그램 연결</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#6f6a61]">
              인스타그램 계정으로 직접 로그인해 연결합니다. 페이스북 계정 없이도 이용할 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      {params.connected === 'meta' && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
          Instagram 계정이 성공적으로 연결되었습니다.
        </div>
      )}
      {params.error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          {getMetaErrorMessage(params.error)}
        </div>
      )}

      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-bold text-amber-900">연결 전 필수 확인 사항</p>
            <ul className="mt-3 space-y-2 text-sm text-amber-800">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 font-bold">1.</span>
                <span>인스타그램 계정이 <strong>프로페셔널 계정(비즈니스 또는 크리에이터)</strong>이어야 합니다. 일반 개인 계정은 API 자동 업로드가 불가합니다.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 font-bold">2.</span>
                <span>개인 계정은 인스타그램 앱 → 설정 → 계정 → <strong>프로페셔널 계정으로 전환</strong>에서 무료로 변경할 수 있습니다.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="panel rounded-lg p-6 md:p-8">
        <div className="flex items-center gap-3">
          <CheckCircle2 className={`h-6 w-6 shrink-0 ${isConnected ? 'text-emerald-600' : 'text-[#aaa49a]'}`} />
          <div>
            <p className="text-sm font-black text-neutral-950">
              {isConnected ? '연결됨' : '미연결'}
            </p>
            {isConnected && account?.username && (
              <p className="mt-0.5 text-xs text-[#6f6a61]">@{account.username}</p>
            )}
            {isConnected && !account?.username && (
              <p className="mt-0.5 text-xs text-[#6f6a61]">{account?.instagramAccountId}</p>
            )}
          </div>
        </div>

        <div className="mt-6 border-t border-[#ece9e0] pt-6">
          <p className="mb-4 text-sm leading-6 text-[#6f6a61]">
            아래 버튼을 누르면 Instagram 로그인 화면으로 이동합니다. 로그인 후 자동으로 계정이 연동됩니다.
          </p>
          <a
            href={oauthConfigured ? `/api/auth/meta/start?brandId=${brand.id}` : '#'}
            aria-disabled={!oauthConfigured}
            className={`btn-primary flex w-full items-center justify-center gap-2 px-4 ${!oauthConfigured ? 'pointer-events-none opacity-50' : ''}`}
          >
            <InstagramIcon className="h-4 w-4" />
            {isConnected ? '다른 계정으로 재연결' : 'Instagram으로 연결'}
          </a>
          {!oauthConfigured && (
            <p className="mt-3 text-center text-xs text-[#aaa49a]">
              서비스 운영자가 Meta 앱 설정을 완료해야 활성화됩니다.
            </p>
          )}
        </div>

        <div className="mt-4 border-t border-[#ece9e0] pt-4 text-xs text-[#6f6a61]">
          브랜드: <strong className="text-neutral-950">{brand.name}</strong>
        </div>
      </div>
    </div>
  )
}

function getMetaErrorMessage(error: string) {
  const map: Record<string, string> = {
    meta_config_missing: 'Meta 앱 설정이 필요합니다.',
    meta_callback_invalid: 'OAuth callback 요청이 올바르지 않습니다.',
    meta_state_invalid: 'OAuth state 검증에 실패했습니다.',
    brand_forbidden: '브랜드 접근 권한이 없습니다.',
    no_instagram_business_account: '프로페셔널 계정(비즈니스 또는 크리에이터)만 연결할 수 있습니다. 인스타그램 앱에서 계정을 전환한 후 다시 시도하세요.',
    meta_oauth_failed: 'Instagram 연결에 실패했습니다. 다시 시도해 주세요.',
  }
  return map[error] || 'Instagram 연결 중 오류가 발생했습니다.'
}
