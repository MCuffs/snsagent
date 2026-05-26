import { redirect } from 'next/navigation'
import { getSessionUser, getCachedBrands } from '../../../lib/auth/user'
import ConceptForm from './ConceptForm'

export const dynamic = 'force-dynamic'

export default async function ConceptPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const brands = await getCachedBrands(user.id)
  const existingBrand = brands[0] || null

  const serializedBrand = existingBrand
    ? {
        id: existingBrand.id,
        name: existingBrand.name,
        industry: existingBrand.industry,
        targetAudience: existingBrand.targetAudience,
        toneOfVoice: existingBrand.toneOfVoice,
        mainColor: existingBrand.mainColor,
        forbiddenWords: existingBrand.forbiddenWords,
        ctaStyle: existingBrand.ctaStyle,
        brandDna: existingBrand.brandDna,
        websiteUrl: existingBrand.websiteUrl,
      }
    : null

  return <ConceptForm existingBrand={serializedBrand} />
}
