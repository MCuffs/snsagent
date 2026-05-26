'use client'

import { useTab } from '../TabContext'
import ConceptForm from './ConceptForm'
import GenerateForm from '../generate/GenerateForm'
import WorksGrid from '../works/WorksGrid'
import { motion } from 'framer-motion'

interface DashboardContainerProps {
  existingBrand: {
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
  } | null
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
}

export default function DashboardContainer({
  existingBrand,
  campaigns,
  planName,
  retentionDays,
  canUpgradeRetention,
}: DashboardContainerProps) {
  const { activeTab: tab } = useTab()

  const hasCompleteBrand = existingBrand && Boolean(existingBrand.websiteUrl)
  const activeTab = (!hasCompleteBrand && tab !== 'concept') ? 'concept' : tab

  return (
    <div className="h-full">
      {activeTab === 'concept' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="h-full"
        >
          <ConceptForm existingBrand={existingBrand} />
        </motion.div>
      )}
      {activeTab === 'generate' && existingBrand && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="h-full"
        >
          <GenerateForm
            brand={{
              id: existingBrand.id,
              name: existingBrand.name,
              industry: existingBrand.industry,
              targetAudience: existingBrand.targetAudience,
              toneOfVoice: existingBrand.toneOfVoice,
              mainColor: existingBrand.mainColor,
              forbiddenWords: existingBrand.forbiddenWords,
              ctaStyle: existingBrand.ctaStyle,
              brandDna: existingBrand.brandDna || null,
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
    </div>
  )
}
