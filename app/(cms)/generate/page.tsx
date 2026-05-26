import { redirect } from 'next/navigation'
import { getSessionUser, getCachedBrands } from '../../../lib/auth/user'
import GenerateForm from './GenerateForm'

export const dynamic = 'force-dynamic'

export default async function GeneratePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const brands = await getCachedBrands(user.id)
  if (brands.length === 0 || !brands[0].websiteUrl) {
    redirect('/concept')
  }

  const brand = brands[0]

  return (
    <GenerateForm
      brand={{
        id: brand.id,
        name: brand.name,
        industry: brand.industry,
        targetAudience: brand.targetAudience,
        toneOfVoice: brand.toneOfVoice,
        mainColor: brand.mainColor,
        forbiddenWords: brand.forbiddenWords,
        ctaStyle: brand.ctaStyle,
        brandDna: brand.brandDna,
      }}
    />
  )
}
