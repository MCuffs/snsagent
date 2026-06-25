import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function YouTubeAutomationPage() {
  redirect('/concept?tab=youtube-automation')
}
