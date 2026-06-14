'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTab } from '../TabContext'
import ConceptForm from './ConceptForm'
import GeneralProfileForm from './GeneralProfileForm'
import GenerateForm from '../generate/GenerateForm'
import WorksGrid from '../works/WorksGrid'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Globe, TrendingUp, Sparkles } from 'lucide-react'

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
  nicepayClientKey?: string
  nicepayReturnTokens?: Record<string, string>
  summarizedPreference?: SummarizedPreferenceData | null
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
  nicepayClientKey,
  nicepayReturnTokens,
  summarizedPreference,
}: DashboardContainerProps) {
  const { activeTab: tab, setActiveTab } = useTab()
  const t = useTranslations('concept')
  const searchParams = useSearchParams()
  const urlBrandId = searchParams?.get('brandId') || null
  const [generalProfile, setGeneralProfile] = useState(existingGeneralProfile)
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null)

  // null = 선택 화면, 'brand' = URL 프로필 폼, 'general' = 시사/트렌드 폼
  const [subProfile, setSubProfile] = useState<'brand' | 'general' | null>(() => {
    // URL에 general profile의 brandId가 있으면 general 폼으로 바로 진입
    if (urlBrandId && existingGeneralProfile && urlBrandId === existingGeneralProfile.id) return 'general'
    // URL에 brand ID가 있으면 brand 폼으로 바로 진입
    if (urlBrandId && existingBrand && urlBrandId === existingBrand.id) return 'brand'
    // 선택 화면 표시
    return null
  })

  const hasProfile = (existingBrand && Boolean(existingBrand.websiteUrl)) || generalProfile
  const activeTab = (!hasProfile && tab !== 'concept') ? 'concept' : tab

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

  let brandToPass = existingBrand
  const activeBrandId = selectedBrandId || urlBrandId
  if (activeBrandId) {
    if (generalProfile && activeBrandId === generalProfile.id) {
      brandToPass = generalProfile
    } else if (existingBrand && activeBrandId === existingBrand.id) {
      brandToPass = existingBrand
    } else {
      brandToPass = existingBrand || generalProfile
    }
  } else {
    brandToPass = existingBrand || generalProfile
  }

  return (
    <div className="h-full">
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
                onSelect={setSubProfile}
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

      {brandToPass && (
        <div className={activeTab === 'generate' ? 'h-full' : 'hidden'}>
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
            nicepayClientKey={nicepayClientKey}
            nicepayReturnTokens={nicepayReturnTokens}
          />
        </div>
      )}

      <div className={activeTab === 'works' ? 'h-full' : 'hidden'}>
        <WorksGrid
          campaigns={campaigns}
          planName={planName}
          retentionDays={retentionDays}
          canUpgradeRetention={canUpgradeRetention}
        />
      </div>
    </div>
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
              className="group relative flex flex-col items-start gap-4 rounded-2xl border border-[#e4e4e7] bg-white p-6 text-left shadow-sm transition-all hover:border-[#111111] hover:shadow-md active:scale-[0.98]"
            >
              {complete && (
                <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" />
                  {t('profile_complete')}
                </span>
              )}
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f4f4f5] transition-colors group-hover:bg-[#111111]">
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

