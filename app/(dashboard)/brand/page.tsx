import { redirect } from 'next/navigation'
import { getSessionUser } from '../../actions'
import { checkBrandCountLimit } from '../../../lib/limits'
import { dbService } from '../../../lib/db-service'
import BrandForm from './BrandForm'

export const dynamic = 'force-dynamic'

export default async function BrandSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const brands = await dbService.getBrands(user.id)
  const existingBrand = brands[0] || null
  const limitCheck = await checkBrandCountLimit(user.id)

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
      }
    : null

  return (
    <BrandForm
      existingBrand={serializedBrand}
      limitAllowed={limitCheck.allowed}
      limitCount={limitCheck.limit}
      userPlan={user.plan}
      startWithUrl={params.start === '1'}
    />
  )
}
