import { ReactNode } from 'react'
import { requireAdminUser } from '../../lib/admin'
import { AdminShell } from './_components/AdminShell'

// Shell itself is dynamic (auth check), but child pages handle their own caching
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdminUser()
  return <AdminShell adminEmail={admin.email}>{children}</AdminShell>
}
