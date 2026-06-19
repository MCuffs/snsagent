import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function VideoPage() {
  redirect('/concept?tab=video')
}
