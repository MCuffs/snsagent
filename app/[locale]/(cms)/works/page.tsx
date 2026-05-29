import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function WorksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  redirect(`/${locale}/concept?tab=works`)
}
