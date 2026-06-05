import { ReactNode } from 'react'
import { requireAdminUser } from '../../lib/admin'
import { AdminShell } from './_components/AdminShell'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdminUser()
  return <AdminShell adminEmail={admin.email}>{children}</AdminShell>
}
