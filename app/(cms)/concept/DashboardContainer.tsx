'use client'

import { useSearchParams } from 'next/navigation'
import ConceptForm from './ConceptForm'
import GenerateForm from '../generate/GenerateForm'
import WorksGrid from '../works/WorksGrid'

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
  }>
}

export default function DashboardContainer({ existingBrand, campaigns }: DashboardContainerProps) {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') || 'concept'

  const hasCompleteBrand = existingBrand && Boolean(existingBrand.websiteUrl)
  const activeTab = (!hasCompleteBrand && tab !== 'concept') ? 'concept' : tab

  return (
    <>
      {activeTab === 'concept' && <ConceptForm existingBrand={existingBrand} />}
      {activeTab === 'generate' && existingBrand && (
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
      )}
      {activeTab === 'works' && <WorksGrid campaigns={campaigns} />}
    </>
  )
}
