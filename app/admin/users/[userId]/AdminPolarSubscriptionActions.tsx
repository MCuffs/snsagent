'use client'

import { useFormStatus } from 'react-dom'
import { revokePolarSubscriptionAction } from '../../actions'
import { inputCls } from '../../_components/adminUtils'

export function AdminPolarSubscriptionActions({
  userId,
  subscriptionId,
}: {
  userId: string
  subscriptionId: string
}) {
  return (
    <form
      action={revokePolarSubscriptionAction}
      className="space-y-2"
      onSubmit={(event) => {
        const confirmed = window.confirm(
          'Polar 구독을 즉시 해지하고 사용자를 Free 플랜으로 전환합니다. 계속하시겠습니까?',
        )
        if (!confirmed) event.preventDefault()
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <p className="break-all rounded-lg bg-[#f7f7f7] px-3 py-2 font-mono text-[11px] text-[#777]">
        {subscriptionId}
      </p>
      <input name="reason" required placeholder="즉시 해지 사유" className={inputCls} />
      <RevokeButton />
    </form>
  )
}

function RevokeButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? '해지 처리 중…' : 'Polar 구독 즉시 해지'}
    </button>
  )
}
