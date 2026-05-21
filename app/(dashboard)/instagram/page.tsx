import { redirect } from 'next/navigation'
import { getSessionUser, quickConnectInstagramAction, saveInstagramAccountAction } from '../../actions'
import { dbService } from '../../../lib/db-service'
import { tokenEncryptor } from '../../../lib/instagram/client'
import { isInstagramMockMode } from '../../../lib/env'
import { Link2, Link2Off, ShieldAlert, CheckCircle2, Zap, KeyRound } from 'lucide-react'
import InstagramIcon from '../../components/InstagramIcon'

export const dynamic = 'force-dynamic'

export default async function InstagramSettingsPage() {
  const user = await getSessionUser()
  if (!user) return null

  // Fetch the brand to display settings for
  const brands = await dbService.getBrands(user.id)
  
  if (brands.length === 0) {
    redirect('/brand')
  }

  const brand = brands[0]
  const account = await dbService.getInstagramAccount(user.id, brand.id)
  
  // Re-decrypt access token representation for form pre-population (in secure format)
  const decryptedToken = account ? safeDecryptToken(account.accessTokenEncrypted) : ''

  // Form submit handler using inline server action
  async function handleSubmit(formData: FormData) {
    'use server'
    const accountId = formData.get('accountId') as string
    const accessToken = formData.get('accessToken') as string

    const res = await saveInstagramAccountAction(brand.id, accountId, accessToken)
    if (res.success) {
      redirect('/dashboard')
    }
  }

  async function handleQuickConnect() {
    'use server'
    const res = await quickConnectInstagramAction(brand.id)
    if (res.success) {
      redirect('/dashboard')
    }
  }

  const mockMode = isInstagramMockMode()
  const maskedAccountId = account?.instagramAccountId
    ? `${account.instagramAccountId.slice(0, 6)}••••${account.instagramAccountId.slice(-4)}`
    : null

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 font-sans">
      {/* Title */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2">
          <InstagramIcon className="w-8 h-8 text-[#ff4f00]" />
          <span>인스타그램 계정 연동</span>
        </h1>
        <p className="text-sm text-slate-500 font-medium">
          데모 환경에서는 빠른 연동으로 바로 시작하고, 실제 운영 전환 시 Meta Graph API 정보를 직접 입력하면 됩니다.
        </p>
      </div>

      {/* Quick Connect */}
      {mockMode && (
        <div className="rounded-xl border border-orange-200 bg-orange-50/70 p-6 shadow-sm flex flex-col md:flex-row gap-5 md:items-center md:justify-between">
          <div className="flex gap-4 items-start">
            <div className="w-11 h-11 rounded-lg bg-[#ff4f00] text-white flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-black text-slate-900">데모 빠른 연동</h2>
              <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                Meta 개발자 설정 없이 로컬 시뮬레이션 계정을 연결합니다. 카드뉴스 승인, 예약, 가상 발행 흐름을 바로 테스트할 수 있습니다.
              </p>
            </div>
          </div>
          <form action={handleQuickConnect} className="w-full md:w-auto">
            <button
              type="submit"
              className="w-full md:w-auto px-5 py-3 rounded-lg text-xs font-extrabold bg-[#ff4f00] hover:bg-[#e04500] text-white active:scale-[0.98] transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              <span>1초 만에 데모 계정 연결</span>
            </button>
          </form>
        </div>
      )}

      {/* Security Notice */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-3 shadow-sm">
        <div className="flex items-center gap-2 text-slate-800">
          <ShieldAlert className="w-5.5 h-5.5 flex-shrink-0" />
          <h3 className="font-extrabold text-sm sm:text-base">운영 연동 전 확인 사항</h3>
        </div>
        <div className="text-xs text-slate-600 leading-relaxed space-y-1.5 font-medium">
          <p>Access Token은 서버에서 AES 방식으로 암호화해 저장합니다.</p>
          <p>운영 계정은 `instagram_content_publish` 등 필요한 최소 권한만 부여하세요.</p>
        </div>
      </div>

      {/* Status Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 border border-slate-200 rounded-xl bg-white shadow-sm p-8 space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">실제 Meta API 연동</h2>
              <p className="text-xs text-slate-500 font-semibold mt-1">운영 계정을 연결할 때만 입력하면 됩니다.</p>
            </div>
            <KeyRound className="w-5 h-5 text-slate-400" />
          </div>
          
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="accountId" className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                Instagram Account ID (비즈니스 계정 ID)
              </label>
              <input
                id="accountId"
                name="accountId"
                type="text"
                required={!mockMode}
                placeholder={mockMode ? '데모에서는 비워두고 빠른 연동 사용 가능' : '예: 17841401234567890'}
                defaultValue={account?.instagramAccountId || ''}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ff4f00] focus:ring-1 focus:ring-[#ff4f00] transition-all font-medium"
              />
              <p className="text-[10px] text-slate-400 font-semibold">
                페이스북 페이지 설정 또는 Graph API 탐색기에서 확인 가능한 17자리 숫자로 이루어진 계정 고유 ID입니다.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="accessToken" className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                Meta Graph API Access Token (액세스 토큰)
              </label>
              <input
                id="accessToken"
                name="accessToken"
                type="password"
                required={!mockMode}
                placeholder={decryptedToken ? '••••••••••••••••••••••••••••••••' : 'EAAGxxxxxxxxxxxx...'}
                defaultValue={decryptedToken}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ff4f00] focus:ring-1 focus:ring-[#ff4f00] transition-all font-medium"
              />
              <p className="text-[10px] text-slate-400 font-semibold">
                개발자 센터에서 발급한 비즈니스 만료 기간 연장(60일 또는 무기한) 시스템 토큰을 붙여넣으세요.
              </p>
            </div>

            <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row gap-3 justify-between items-center">
              <span className="text-[10px] text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1 rounded-full font-bold">
                {mockMode ? '개발 환경: 빠른 연동 사용 가능' : '운영 환경: Meta API 실시간 연동'}
              </span>
              <button
                type="submit"
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-xs font-extrabold bg-[#ff4f00] hover:bg-[#e04500] text-white active:scale-[0.98] transition-all cursor-pointer shadow-sm"
              >
                실제 계정 정보 저장
              </button>
            </div>
          </form>
        </div>

        {/* Info Box */}
        <div className="border border-slate-200 rounded-xl bg-white shadow-sm p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-extrabold text-slate-900 text-sm">현재 연결 정보</h3>
            
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center text-center py-8">
              {account?.status === 'CONNECTED' ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mb-3">
                    <Link2 className="w-6 h-6" />
                  </div>
                  <p className="font-bold text-slate-900 text-sm">연동 활성화 완료</p>
                  <p className="text-[11px] text-slate-500 mt-1 font-semibold">{maskedAccountId}</p>
                  <span className="text-[9px] px-2 py-0.5 mt-3 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-250 font-black tracking-wider">ACTIVE</span>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center mb-3">
                    <Link2Off className="w-6 h-6" />
                  </div>
                  <p className="font-bold text-slate-400 text-sm">연동되지 않음</p>
                  <p className="text-[10px] text-slate-400 mt-1 font-medium">API 토큰을 등록해 주세요.</p>
                </>
              )}
            </div>
          </div>

          <div className="text-[10px] text-slate-500 border-t border-slate-100 pt-4 space-y-2 mt-4 font-bold">
            <div className="flex gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>미디어 업로드 및 게시 승인</span>
            </div>
            <div className="flex gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>다이렉트 퍼블리싱 지원</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function safeDecryptToken(encryptedToken: string) {
  try {
    return tokenEncryptor.decrypt(encryptedToken)
  } catch (error) {
    console.warn('Failed to decrypt Instagram token for form display', error)
    return ''
  }
}
