'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useTab } from '../TabContext'
import ConceptForm from './ConceptForm'
import GeneralProfileForm from './GeneralProfileForm'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Globe, TrendingUp, Sparkles, LogIn, Plus, Lock, X } from 'lucide-react'
import Link from 'next/link'

const GenerateForm = dynamic(() => import('../generate/GenerateForm'), { loading: DashboardLoading })
const VideoCardNewsForm = dynamic(() => import('../video-cardnews/VideoCardNewsForm'), { loading: DashboardLoading })
const YouTubeAutomationDashboard = dynamic(() => import('../youtube-automation/YouTubeAutomationDashboard'), { loading: DashboardLoading })
const ShortsLabCmsPanel = dynamic(() => import('../../shorts-lab/ShortsLabCmsPanel'), { loading: DashboardLoading })
const WorksGrid = dynamic(() => import('../works/WorksGrid'), { loading: DashboardLoading })

function DashboardLoading() {
  return (
    <div className="flex h-full items-center justify-center" role="status" aria-live="polite">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#d7dce5] border-t-[#4252ff]" />
      <span className="sr-only">Loading</span>
    </div>
  )
}

interface BrandProfileData {
  id: string
  name: string
  industry: string
  targetAudience: string
  toneOfVoice: string
  mainColor: string
  forbiddenWords: string
  ctaStyle: string
  brandDna?: string | null
  websiteUrl?: string | null
}

interface SummarizedPreferenceData {
  summary: string | null
  preferredHookPatterns: string | null
  preferredLayouts: string | null
  avoidPatterns: string | null
  preferredCopyTone: string | null
}

interface DashboardContainerProps {
  existingBrand: BrandProfileData | null
  existingGeneralProfile: BrandProfileData | null
  campaigns: Array<{
    id: string
    title: string
    status: string
    createdAt: string
    thumbnail: string | null
    expiresAt: string
    daysUntilDeletion: number
    expiresSoon: boolean
  }>
  planName: string
  retentionDays: number
  canUpgradeRetention: boolean
  userEmail?: string | null
  userId?: string
  userName?: string | null
  summarizedPreference?: SummarizedPreferenceData | null
  isGuest?: boolean
  hasVideoApiKey?: boolean
  userPlan?: string | null
  canAccessShortsLab?: boolean
}

export default function DashboardContainer({
  existingBrand,
  existingGeneralProfile,
  campaigns,
  planName,
  retentionDays,
  canUpgradeRetention,
  userEmail,
  userId,
  userName,
  summarizedPreference,
  isGuest = false,
  hasVideoApiKey = false,
  userPlan,
  canAccessShortsLab = false,
}: DashboardContainerProps) {
  const { activeTab: tab, setActiveTab } = useTab()
  const activeTab = tab === 'shorts-lab' && !canAccessShortsLab
    ? 'youtube-automation'
    : tab
  const [mountedTabs, setMountedTabs] = useState(() => new Set([activeTab]))
  const t = useTranslations('concept')
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlBrandId = searchParams?.get('brandId') || null
  const [generalProfile, setGeneralProfile] = useState(existingGeneralProfile)
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const [showVideoUpgradePrompt, setShowVideoUpgradePrompt] = useState(false)
  const [dismissedVideoUpgradePrompt, setDismissedVideoUpgradePrompt] = useState(false)
  const isFreePlan = !userPlan || userPlan === 'FREE'
  const localePrefix = pathname?.startsWith('/ko/') || pathname === '/ko'
    ? '/ko'
    : pathname?.startsWith('/en/') || pathname === '/en'
      ? '/en'
      : ''
  const pricingPath = `${localePrefix}/pricing`
  const isYouTubePromoPlan = userPlan === 'YOUTUBE_PROMO'
  const canUseVideoFeatures = !isFreePlan && !isYouTubePromoPlan
  const canUseYouTubeAutomation = true
  const activeCreatorTabBlocked =
    ((activeTab === 'video-cardnews' || activeTab === 'video') && !canUseVideoFeatures)
  const shouldShowVideoUpgradePrompt = showVideoUpgradePrompt || (activeCreatorTabBlocked && !dismissedVideoUpgradePrompt)
  const closeVideoUpgradePrompt = () => {
    setShowVideoUpgradePrompt(false)
    setDismissedVideoUpgradePrompt(true)
  }

  useEffect(() => {
    if (mountedTabs.has(activeTab)) return
    const frame = window.requestAnimationFrame(() => {
      setMountedTabs(current => new Set(current).add(activeTab))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeTab, mountedTabs])

  const handleGuestAction = () => {
    if (isGuest) {
      setShowLoginPrompt(true)
      return true
    }
    return false
  }

  // null = 선택 화면, 'brand' = URL 프로필 폼, 'general' = 시사/트렌드 폼
  const [subProfile, setSubProfile] = useState<'brand' | 'general' | null>(() => {
    // URL에 general profile의 brandId가 있으면 general 폼으로 바로 진입
    if (urlBrandId && existingGeneralProfile && urlBrandId === existingGeneralProfile.id) return 'general'
    // URL에 brand ID가 있으면 brand 폼으로 바로 진입
    if (urlBrandId && existingBrand && urlBrandId === existingBrand.id) return 'brand'
    // 선택 화면 표시
    return null
  })
  const urlProfile = existingBrand && Boolean(existingBrand.websiteUrl) ? existingBrand : null
  const hasAnyProfile = Boolean(urlProfile || generalProfile)

  const handleGeneralProfileSaved = (profile: BrandProfileData) => {
    setGeneralProfile(profile)
  }

  const handleContinueToGenerate = (profile: BrandProfileData) => {
    setGeneralProfile(profile)
    setSelectedBrandId(profile.id)

    const params = new URLSearchParams(window.location.search)
    params.set('brandId', profile.id)
    const newUrl = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState(null, '', newUrl)
    setActiveTab('generate')
  }

  const handleGenerateProfileChange = (profile: BrandProfileData) => {
    if (profile.id === activeBrandId) return

    setSelectedBrandId(profile.id)
    const params = new URLSearchParams(window.location.search)
    params.set('brandId', profile.id)
    params.set('tab', 'generate')
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
  }

  const handleCreateProfile = (type: 'brand' | 'general') => {
    if (handleGuestAction()) return
    setSubProfile(type)
    const params = new URLSearchParams(window.location.search)
    params.delete('brandId')
    const query = params.toString()
    window.history.replaceState(null, '', query ? `${window.location.pathname}?${query}` : window.location.pathname)
    setActiveTab('concept')
  }

  let brandToPass = urlProfile
  const activeBrandId = selectedBrandId || urlBrandId
  if (activeBrandId) {
    if (generalProfile && activeBrandId === generalProfile.id) {
      brandToPass = generalProfile
    } else if (urlProfile && activeBrandId === urlProfile.id) {
      brandToPass = urlProfile
    } else {
      brandToPass = urlProfile || generalProfile
    }
  } else {
    brandToPass = urlProfile || generalProfile
  }

  const tabPanelClass = (tabName: string, baseClass = 'h-full') =>
    `${baseClass} absolute inset-0 transform-gpu transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${
      activeTab === tabName
        ? 'z-10 translate-y-0 scale-100 opacity-100 pointer-events-auto'
        : 'z-0 translate-y-1 opacity-0 pointer-events-none'
    }`

  return (
    <div className="relative h-full overflow-hidden bg-transparent">
      {showLoginPrompt && (
        <GuestLoginOverlay onClose={() => setShowLoginPrompt(false)} />
      )}
      {shouldShowVideoUpgradePrompt && (
        <VideoUpgradeOverlay pricingPath={pricingPath} onClose={closeVideoUpgradePrompt} />
      )}
      <div className={tabPanelClass('concept')} aria-hidden={activeTab !== 'concept'}>
        <div className="flex h-full flex-col">
          {subProfile !== null && (
            <div className="shrink-0 border-b border-white/60 bg-white/62 px-6 py-2.5 backdrop-blur-xl">
              <button
                type="button"
                onClick={() => setSubProfile(null)}
                className="text-xs font-bold text-[#64748b] transition-colors hover:text-[#111827]"
              >
                ← {subProfile === 'brand' ? t('select_url_title') : t('select_general_title')}
              </button>
            </div>
          )}

          <div className="flex-1 overflow-hidden">
            {subProfile === null && (
              <ProfileSelectScreen
                hasUrlProfile={existingBrand && Boolean(existingBrand.websiteUrl) ? true : false}
                hasGeneralProfile={Boolean(generalProfile)}
                onSelect={(type) => {
                  if (handleGuestAction()) return
                  setSubProfile(type)
                }}
                summarizedPreference={summarizedPreference}
              />
            )}

            {subProfile === 'brand' && (
              <motion.div
                key="brand-profile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                <ConceptForm existingBrand={existingBrand} />
              </motion.div>
            )}

            {subProfile === 'general' && (
              <motion.div
                key="general-profile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                <GeneralProfileForm
                  existingProfile={generalProfile}
                  onProfileSaved={handleGeneralProfileSaved}
                  onContinueToGenerate={handleContinueToGenerate}
                />
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <div className={tabPanelClass('generate', 'flex h-full flex-col')} aria-hidden={activeTab !== 'generate'}>
          {hasAnyProfile && <div className="flex shrink-0 items-center gap-3 overflow-x-auto border-b border-white/60 bg-white/48 px-5 py-2.5 backdrop-blur-xl">
            <span className="shrink-0 text-xs font-bold text-[#64748b]">{t('generate_profile_label')}</span>
            <div className="flex shrink-0 items-center gap-1 rounded-xl border border-white/70 bg-white/50 p-1 shadow-[0_10px_24px_rgba(87,119,185,0.08)]">
              {urlProfile ? (
                <GenerateProfileButton
                  active={brandToPass?.id === urlProfile.id}
                  icon={Globe}
                  label={t('select_url_title')}
                  onClick={() => handleGenerateProfileChange(urlProfile)}
                />
              ) : (
                <CreateProfileButton
                  icon={Globe}
                  label={t('select_url_title')}
                  createLabel={t('create_profile')}
                  onClick={() => handleCreateProfile('brand')}
                />
              )}
              {generalProfile ? (
                <GenerateProfileButton
                  active={brandToPass?.id === generalProfile.id}
                  icon={TrendingUp}
                  label={t('select_general_title')}
                  onClick={() => handleGenerateProfileChange(generalProfile)}
                />
              ) : (
                <CreateProfileButton
                  icon={TrendingUp}
                  label={t('select_general_title')}
                  createLabel={t('create_profile')}
                  onClick={() => handleCreateProfile('general')}
                />
              )}
            </div>
          </div>}
          <div className="min-h-0 flex-1">
            {!mountedTabs.has('generate') ? (
              <DashboardLoading />
            ) : brandToPass ? (
              <GenerateForm
                key={brandToPass.id}
                brand={{
                  id: brandToPass.id,
                  name: brandToPass.name,
                  industry: brandToPass.industry,
                  targetAudience: brandToPass.targetAudience,
                  toneOfVoice: brandToPass.toneOfVoice,
                  mainColor: brandToPass.mainColor,
                  forbiddenWords: brandToPass.forbiddenWords,
                  ctaStyle: brandToPass.ctaStyle,
                  brandDna: brandToPass.brandDna || null,
                  websiteUrl: brandToPass.websiteUrl || null,
                }}
                userId={userId}
                userEmail={userEmail}
                userName={userName}
              />
            ) : (
              <div className="flex h-full items-center justify-center px-6 py-10 text-center">
                <div className="w-full max-w-xl">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#f4f4f5]">
                    <Plus className="h-5 w-5 text-[#52525b]" />
                  </div>
                  <h2 className="mt-4 text-base font-bold text-[#111111]">{t('generate_empty_title')}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#71717a]">{t('generate_empty_desc')}</p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <EmptyProfileChoice
                      icon={Globe}
                      title={t('select_url_title')}
                      description={t('select_url_desc')}
                      actionLabel={t('create_profile')}
                      onClick={() => handleCreateProfile('brand')}
                    />
                    <EmptyProfileChoice
                      icon={TrendingUp}
                      title={t('select_general_title')}
                      description={t('select_general_desc')}
                      actionLabel={t('create_profile')}
                      onClick={() => handleCreateProfile('general')}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      <div className={tabPanelClass('video')} aria-hidden={activeTab !== 'video'}>
        {!canUseVideoFeatures ? (
          <VideoUpgradeEmptyState pricingPath={pricingPath} />
        ) : mountedTabs.has('video') && brandToPass ? (
          <VideoCardNewsForm
            brand={brandToPass}
            hasApiKey={hasVideoApiKey}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-12 text-sm text-[#71717a]">
            {t('setup_brand_first')}
          </div>
        )}
      </div>

      <div className={tabPanelClass('works')} aria-hidden={activeTab !== 'works'}>
        {mountedTabs.has('works') && (
          <WorksGrid
            campaigns={campaigns}
            planName={planName}
            retentionDays={retentionDays}
            canUpgradeRetention={canUpgradeRetention}
          />
        )}
      </div>

      <div className={tabPanelClass('youtube-automation')} aria-hidden={activeTab !== 'youtube-automation'}>
        {!canUseYouTubeAutomation ? (
          <VideoUpgradeEmptyState
            pricingPath={pricingPath}
            featureName="유튜브 자동화"
            title="유튜브 자동화는 YouTube Promo 플랜부터 사용할 수 있습니다."
            description="월 9,900원 YouTube Promo 플랜에서 30일 쇼츠 플래너와 유튜브 자동화를 사용할 수 있습니다."
          />
        ) : mountedTabs.has('youtube-automation') ? (
          <YouTubeAutomationDashboard
            isActive={activeTab === 'youtube-automation'}
            isGuest={isGuest}
            onRequireLogin={() => setShowLoginPrompt(true)}
          />
        ) : (
          <DashboardLoading />
        )}
      </div>

      {canAccessShortsLab && (
        <div className={tabPanelClass('shorts-lab')} aria-hidden={activeTab !== 'shorts-lab'}>
          {mountedTabs.has('shorts-lab') ? (
            <ShortsLabCmsPanel
              isActive={activeTab === 'shorts-lab'}
              userId={userId ?? ''}
            />
          ) : (
            <DashboardLoading />
          )}
        </div>
      )}

      {brandToPass && (
        <div className={tabPanelClass('video-cardnews')} aria-hidden={activeTab !== 'video-cardnews'}>
          {!canUseVideoFeatures ? (
            <VideoUpgradeEmptyState pricingPath={pricingPath} />
          ) : mountedTabs.has('video-cardnews') ? (
            <VideoCardNewsForm
              brand={{
                id: brandToPass.id,
                name: brandToPass.name,
                industry: brandToPass.industry,
                targetAudience: brandToPass.targetAudience,
                toneOfVoice: brandToPass.toneOfVoice,
                mainColor: brandToPass.mainColor,
              }}
              hasApiKey={hasVideoApiKey}
            />
          ) : (
            <DashboardLoading />
          )}
        </div>
      )}
    </div>
  )
}

function GenerateProfileButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: typeof Globe
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? 'bg-white/90 text-[#111111] shadow-sm'
          : 'text-[#64748b] hover:bg-white/58 hover:text-[#111111]'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

function CreateProfileButton({
  icon: Icon,
  label,
  createLabel,
  onClick,
}: {
  icon: typeof Globe
  label: string
  createLabel: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-white/80 bg-white/42 px-3 py-1.5 text-xs font-semibold text-[#64748b] transition-colors hover:border-[#cbd5e1] hover:bg-white/70 hover:text-[#111111]"
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
      <span className="inline-flex items-center gap-0.5 text-[#2563eb]">
        <Plus className="h-3 w-3" />
        {createLabel}
      </span>
    </button>
  )
}

function EmptyProfileChoice({
  icon: Icon,
  title,
  description,
  actionLabel,
  onClick,
}: {
  icon: typeof Globe
  title: string
  description: string
  actionLabel: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border border-white/70 bg-white/58 p-5 text-left shadow-[0_14px_34px_rgba(87,119,185,0.08)] backdrop-blur-xl transition-all hover:border-white hover:bg-white/74 hover:shadow-[0_18px_42px_rgba(87,119,185,0.12)]"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 shadow-sm transition-colors group-hover:bg-[#111827]">
        <Icon className="h-4 w-4 text-[#71717a] transition-colors group-hover:text-white" />
      </div>
      <p className="mt-4 text-sm font-bold text-[#111111]">{title}</p>
      <p className="mt-1 text-xs leading-5 text-[#71717a]">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#2563eb]">
        <Plus className="h-3.5 w-3.5" />
        {actionLabel}
      </span>
    </button>
  )
}

function ProfileSelectScreen({
  hasUrlProfile,
  hasGeneralProfile,
  onSelect,
  summarizedPreference,
}: {
  hasUrlProfile: boolean
  hasGeneralProfile: boolean
  onSelect: (type: 'brand' | 'general') => void
  summarizedPreference?: SummarizedPreferenceData | null
}) {
  const t = useTranslations('concept')

  const cards = [
    {
      key: 'brand' as const,
      icon: Globe,
      title: t('select_url_title'),
      desc: t('select_url_desc'),
      complete: hasUrlProfile,
    },
    {
      key: 'general' as const,
      icon: TrendingUp,
      title: t('select_general_title'),
      desc: t('select_general_desc'),
      complete: hasGeneralProfile,
    },
  ]

  const hasPreference = summarizedPreference?.summary && summarizedPreference.summary.trim().length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="relative isolate flex h-full flex-col items-center justify-center overflow-hidden bg-transparent px-6 py-16"
    >
      <ProfileSelectAmbientBackdrop />
      <div className="relative z-10 w-full max-w-[820px]">
        <div className="mb-10 text-center">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#64748b]">Brand Concept</p>
          <h1 className="mt-3 text-[30px] font-black tracking-[-0.01em] text-[#111827] md:text-[34px]">{t('select_title')}</h1>
          <p className="mx-auto mt-3 max-w-[590px] text-sm font-medium leading-6 text-[#64748b]">{t('select_desc')}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {cards.map(({ key, icon: Icon, title, desc, complete }) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className="group relative flex min-h-[190px] flex-col items-start gap-4 rounded-[24px] border border-white/70 bg-white/76 p-6 text-left shadow-[0_18px_48px_rgba(79,70,229,0.10)] backdrop-blur-xl transition-all hover:border-[#c7d2fe] hover:bg-white/86 hover:shadow-[0_22px_60px_rgba(79,70,229,0.13)] active:scale-[0.99]"
            >
              {complete && (
                <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" />
                  {t('profile_complete')}
                </span>
              )}
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f5f7ff] text-[#4252ff] transition-colors group-hover:bg-[#4252ff] group-hover:text-white">
                <Icon className="h-5 w-5 transition-colors" />
              </div>
              <div>
                <p className="text-base font-black text-[#111827]">{title}</p>
                <p className="mt-2 text-sm font-medium leading-6 text-[#64748b]">{desc}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-[24px] border border-white/70 bg-white/66 p-5 shadow-[0_18px_48px_rgba(79,70,229,0.10)] backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-[#4252ff]" />
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#4252ff]">{t('report_title')}</p>
          </div>
          {hasPreference ? (
            <>
              <p className="mt-1 text-sm font-semibold text-[#111111]">
                {t('report_desc')}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#52525b]">{summarizedPreference!.summary}</p>
              <p className="mt-3 text-[11px] text-[#a1a1aa]">{t('report_footer')}</p>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm font-semibold text-[#111111]">
                {t('report_empty_title')}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#71717a]">
                {t('report_empty_desc')}
              </p>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function ProfileSelectAmbientBackdrop() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .shuffla-profile-select-ambient {
          background:
            radial-gradient(circle at 56% 36%, rgba(219, 234, 254, 0.44), transparent 34%),
            radial-gradient(circle at 82% 42%, rgba(237, 233, 254, 0.56), transparent 32%),
            radial-gradient(circle at 44% 54%, rgba(191, 219, 254, 0.28), transparent 30%),
            linear-gradient(180deg, #ffffff 0%, #fbfdff 58%, #ffffff 100%);
          background-size: 150% 150%;
          animation: shufflaProfileSelectAmbientDrift 26s ease-in-out infinite alternate;
        }
        .shuffla-profile-select-ambient::after {
          content: "";
          position: absolute;
          inset: -18%;
          background:
            radial-gradient(circle at 46% 42%, rgba(96, 165, 250, 0.18), transparent 26%),
            radial-gradient(circle at 72% 48%, rgba(168, 85, 247, 0.16), transparent 30%);
          filter: blur(42px);
          animation: shufflaProfileSelectAmbientFloat 34s ease-in-out infinite alternate;
        }
        @keyframes shufflaProfileSelectAmbientDrift {
          0% { background-position: 0% 0%; transform: scale(1); }
          50% { background-position: 58% 38%; transform: scale(1.025); }
          100% { background-position: 100% 84%; transform: scale(1.045); }
        }
        @keyframes shufflaProfileSelectAmbientFloat {
          0% { transform: translate3d(-2%, -1%, 0) rotate(0deg); opacity: 0.42; }
          100% { transform: translate3d(3%, 2%, 0) rotate(3deg); opacity: 0.58; }
        }
      ` }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 shuffla-profile-select-ambient" />
    </>
  )
}

function VideoUpgradeEmptyState({
  pricingPath,
  featureName = '영상 카드뉴스',
  title,
  description = '월 25,000원 Creator 이상 플랜에서 고급 영상 제작 기능을 사용할 수 있습니다.',
}: {
  pricingPath: string
  featureName?: string
  title?: string
  description?: string
}) {
  return (
    <div className="flex h-full items-center justify-center px-6 py-12 text-center">
      <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white/78 p-8 shadow-[0_24px_80px_rgba(79,70,229,0.12)] backdrop-blur-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f5f7ff] text-[#4252ff]">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-lg font-black text-[#111827]">
          {title || `${featureName}는 Creator 플랜부터 사용할 수 있습니다.`}
        </h2>
        <p className="mt-3 text-sm font-medium leading-6 text-[#6b7280]">
          {description}
        </p>
        <Link
          href={pricingPath}
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#111827] px-5 text-sm font-bold text-white transition-colors hover:bg-[#1f2937]"
        >
          요금제 보기
        </Link>
      </div>
    </div>
  )
}

function VideoUpgradeOverlay({ pricingPath, onClose }: { pricingPath: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f5f7ff] text-[#4252ff]">
            <Sparkles className="h-5 w-5" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#9ca3af] transition-colors hover:bg-[#f3f4f6] hover:text-[#111827]"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 className="mt-5 text-lg font-black leading-7 text-[#111827]">Free 플랜에서는 영상 카드뉴스를 만들 수 없습니다.</h2>
        <p className="mt-2 text-sm font-medium leading-6 text-[#6b7280]">
          무료 플랜은 카드뉴스 2회 생성만 제공됩니다. 영상 카드뉴스를 제작하려면 Creator 플랜 이상으로 업그레이드해 주세요.
        </p>
        <div className="mt-6 flex gap-2">
          <Link
            href={pricingPath}
            className="flex flex-1 items-center justify-center rounded-xl bg-[#111827] py-3 text-sm font-bold text-white transition-colors hover:bg-[#1f2937]"
          >
            요금제 보기
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#e5e7eb] px-4 py-3 text-sm font-bold text-[#6b7280] transition-colors hover:bg-[#f9fafb]"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

function GuestLoginOverlay({ onClose }: { onClose: () => void }) {
  const t = useTranslations('concept')
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#eff6ff]">
          <LogIn className="h-6 w-6 text-[#0066ff]" />
        </div>
        <h2 className="text-lg font-bold text-[#111111]">{t('guest_login_title')}</h2>
        <p className="mt-2 text-sm text-[#71717a]">
          {t('guest_login_desc')}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/login"
            className="w-full rounded-xl bg-[#111111] py-3 text-sm font-semibold text-white hover:bg-[#333] transition-colors"
          >
            {t('guest_login_btn')}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-[#71717a] hover:text-[#111111] transition-colors"
          >
            {t('guest_login_later')}
          </button>
        </div>
      </div>
    </div>
  )
}
