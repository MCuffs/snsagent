'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTab } from '../TabContext'
import ConceptForm from './ConceptForm'
import GeneralProfileForm from './GeneralProfileForm'
import GenerateForm from '../generate/GenerateForm'
import VideoCardNewsForm from '../video-cardnews/VideoCardNewsForm'
import WorksGrid from '../works/WorksGrid'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Globe, TrendingUp, Sparkles, LogIn, Plus } from 'lucide-react'
import Link from 'next/link'

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
}: DashboardContainerProps) {
  const { activeTab: tab, setActiveTab } = useTab()
  const t = useTranslations('concept')
  const searchParams = useSearchParams()
  const urlBrandId = searchParams?.get('brandId') || null
  const [generalProfile, setGeneralProfile] = useState(existingGeneralProfile)
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)

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

  const activeTab = tab
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

  return (
    <div className="h-full">
      {showLoginPrompt && (
        <GuestLoginOverlay onClose={() => setShowLoginPrompt(false)} />
      )}
      <div className={activeTab === 'concept' ? 'h-full' : 'hidden'}>
        <div className="flex h-full flex-col">
          {subProfile !== null && (
            <div className="border-b border-[#e4e4e7] bg-white px-6 py-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setSubProfile(null)}
                className="text-xs font-medium text-[#71717a] hover:text-[#111111] transition-colors"
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

      <div className={activeTab === 'generate' ? 'flex h-full flex-col' : 'hidden'}>
          {hasAnyProfile && <div className="flex shrink-0 items-center gap-3 overflow-x-auto border-b border-[#e5e7eb] bg-white px-5 py-2.5">
            <span className="shrink-0 text-xs font-semibold text-[#71717a]">{t('generate_profile_label')}</span>
            <div className="flex shrink-0 items-center gap-1 rounded-lg bg-[#f4f4f5] p-1">
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
            {brandToPass ? (
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

      <div className={activeTab === 'video' ? 'h-full' : 'hidden'}>
        {brandToPass ? (
          <VideoCardNewsForm
            brand={brandToPass}
            hasApiKey={hasVideoApiKey}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-12 text-sm text-[#71717a]">
            브랜드 프로필을 먼저 설정해주세요.
          </div>
        )}
      </div>

      <div className={activeTab === 'works' ? 'h-full' : 'hidden'}>
        <WorksGrid
          campaigns={campaigns}
          planName={planName}
          retentionDays={retentionDays}
          canUpgradeRetention={canUpgradeRetention}
        />
      </div>

      {activeTab === 'video-cardnews' && brandToPass && (
        <div className="h-full">
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
          ? 'bg-white text-[#111111] shadow-sm'
          : 'text-[#71717a] hover:text-[#111111]'
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
      className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[#d4d4d8] bg-white/60 px-3 py-1.5 text-xs font-semibold text-[#71717a] transition-colors hover:border-[#a1a1aa] hover:text-[#111111]"
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
      className="group rounded-xl border border-[#e4e4e7] bg-white p-5 text-left transition-all hover:border-[#a1a1aa] hover:shadow-sm"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f4f4f5] transition-colors group-hover:bg-[#111111]">
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
      className="flex h-full flex-col items-center justify-center px-6 py-16"
    >
      <div className="w-full max-w-lg">
        <div className="mb-10 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[#111111]">{t('select_title')}</h1>
          <p className="mt-2 text-sm text-[#71717a]">{t('select_desc')}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {cards.map(({ key, icon: Icon, title, desc, complete }) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className="group relative flex flex-col items-start gap-4 rounded-xl border border-[#e5e7eb] bg-white p-6 text-left transition-all hover:border-[#d1d5db] hover:shadow-sm active:scale-[0.99]"
            >
              {complete && (
                <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" />
                  {t('profile_complete')}
                </span>
              )}
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f3f4f6] transition-colors group-hover:bg-[#111827]">
                <Icon className="h-5 w-5 text-[#71717a] transition-colors group-hover:text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#111111]">{title}</p>
                <p className="mt-1 text-xs leading-5 text-[#71717a]">{desc}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-[#e4e4e7] bg-gradient-to-br from-[#faf8ff] to-[#f5f3ff] p-5">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-[#8b5cf6]" />
            <p className="text-xs font-bold uppercase tracking-wide text-[#8b5cf6]">AI 학습 리포트</p>
          </div>
          {hasPreference ? (
            <>
              <p className="mt-1 text-sm font-semibold text-[#111111]">
                AI가 학습한 사용자님의 콘텐츠 흐름입니다
              </p>
              <p className="mt-2 text-sm leading-6 text-[#52525b]">{summarizedPreference!.summary}</p>
              <p className="mt-3 text-[11px] text-[#a1a1aa]">카드뉴스를 더 생성할수록 취향이 정교하게 반영됩니다.</p>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm font-semibold text-[#111111]">
                아직 학습된 내용이 없어요
              </p>
              <p className="mt-2 text-sm leading-6 text-[#71717a]">
                카드뉴스를 생성하고 편집할수록 AI가 사용자님의 콘텐츠 스타일과 취향을 파악해
                다음 생성에 자동으로 반영합니다.
              </p>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function GuestLoginOverlay({ onClose }: { onClose: () => void }) {
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
        <h2 className="text-lg font-bold text-[#111111]">로그인이 필요해요</h2>
        <p className="mt-2 text-sm text-[#71717a]">
          카드뉴스를 만들려면 먼저 로그인해 주세요.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/login"
            className="w-full rounded-xl bg-[#111111] py-3 text-sm font-semibold text-white hover:bg-[#333] transition-colors"
          >
            로그인 / 회원가입
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-[#71717a] hover:text-[#111111] transition-colors"
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  )
}
