'use client'

import { useFormStatus } from 'react-dom'
import type { ReactNode } from 'react'

export function AdminSubmitButton({
  children,
  pendingLabel = '처리 중…',
  className,
}: {
  children: ReactNode
  pendingLabel?: string
  className: string
}) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:cursor-not-allowed disabled:opacity-50`}>
      {pending ? pendingLabel : children}
    </button>
  )
}
