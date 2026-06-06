'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTab } from '../TabContext'
import ConceptForm from './ConceptForm'
import GeneralProfileForm from './GeneralProfileForm'
import GenerateForm from '../generate/GenerateForm'
import WorksGrid from '../works/WorksGrid'
import PainterDashboard from '../painter/PainterDashboard'
import InstagramDashboard from '../instagram/InstagramDashboard'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'

// Instagram 기능 테스트용 허용 이메일
const INSTAGRAM_ALLOWED_EMAILS = ['alstnwjd0424@gmail.com']

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
}

export default function DashboardContainer({
  existingBrand,
  existingGeneralProfile,
  campaigns,
  planName,
  retentionDays,
  canUpgradeRetention,
  userEmail,
}: DashboardContainerProps) {
  const { activeTab: tab } = useTab()
  const t = useTranslations('concept')
  const searchParams = useSearchParams()
  const urlBrandId = searchParams?.get('brandId') || null
  const hasInstagramAccess = userEmail ? INSTAGRAM_ALLOWED_EMAILS.includes(userEmail) : false

  const [subTab, setSubTab] = useState<'brand' | 'general'>(() => {
    // URL에 general profile의 brandId가 있으면 general 탭으로 시작
    if (urlBrandId && existingGeneralProfile && urlBrandId === existingGeneralProfile.id) return 'general'
    if (!existingBrand && existingGeneralProfile) return 'general'
    return 'brand'
  })

  const hasProfile = (existingBrand && Boolean(existingBrand.websiteUrl)) || existingGeneralProfile
  const activeTab = (!hasProfile && tab !== 'concept') ? 'concept' : tab

  let brandToPass = existingBrand
  if (urlBrandId) {
    if (existingGeneralProfile && urlBrandId === existingGeneralProfile.id) {
      brandToPass = existingGeneralProfile
    } else if (existingBrand && urlBrandId === existingBrand.id) {
      brandToPass = existingBrand
    } else {
      // urlBrandId가 어느 쪽도 매칭 안 되면 두 프로필 중 존재하는 것 사용
      brandToPass = existingBrand || existingGeneralProfile
    }
  } else {
    brandToPass = existingBrand || existingGeneralProfile
  }

  return (
    <div className="h-full">
      {activeTab === 'concept' && (
        <div className="flex h-full flex-col">
          {/* Sub-tab Switcher */}
          <div className="border-b border-[#e4e4e7] bg-white px-6 py-2.5 shrink-0 flex items-center justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSubTab('brand')}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  subTab === 'brand'
                    ? 'bg-[#111111] text-white shadow-sm'
                    : 'text-[#71717a] hover:bg-[#fafafa] hover:text-[#111111]'
                }`}
              >
                {t('tab_brand')}
              </button>
              <button
                type="button"
                onClick={() => setSubTab('general')}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  subTab === 'general'
                    ? 'bg-[#111111] text-white shadow-sm'
                    : 'text-[#71717a] hover:bg-[#fafafa] hover:text-[#111111]'
                }`}
              >
                {t('tab_general')}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            {subTab === 'brand' ? (
              <motion.div
                key="brand-profile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                <ConceptForm existingBrand={existingBrand} />
              </motion.div>
            ) : (
              <motion.div
                key="general-profile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                <GeneralProfileForm existingProfile={existingGeneralProfile} />
              </motion.div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'generate' && brandToPass && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="h-full"
        >
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
          />
        </motion.div>
      )}

      {activeTab === 'works' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="h-full"
        >
          <WorksGrid
            campaigns={campaigns}
            planName={planName}
            retentionDays={retentionDays}
            canUpgradeRetention={canUpgradeRetention}
          />
        </motion.div>
      )}

      {activeTab === 'painter' && brandToPass && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="h-full"
        >
          <PainterDashboard brand={brandToPass} />
        </motion.div>
      )}

      {activeTab === 'instagram' && hasInstagramAccess && brandToPass && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="h-full"
        >
          <InstagramDashboard brandId={brandToPass.id} userEmail={userEmail || ''} />
        </motion.div>
      )}
    </div>
  )
}

