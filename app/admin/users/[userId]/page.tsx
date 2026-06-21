import { notFound } from 'next/navigation'
import prisma from '../../../../lib/db'
import {
  addAdminNoteAction,
  addCreditsAction,
  changeUserPlanAction,
  createManualPaymentRecordAction,
  updateAccountStatusAction,
} from '../../actions'
import {
  AdminPageHeader, EmptyState, Section, Td, Th,
} from '../../_components/AdminShell'
import { btnCls, formatCurrency, formatDate, formatPlan, inputCls, statusPill } from '../../_components/adminUtils'
import { AdminPolarSubscriptionActions } from './AdminPolarSubscriptionActions'

export const dynamic = 'force-dynamic'

export default async function AdminUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const [user, creditBalanceResult] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        campaigns: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { slides: { select: { id: true } } },
        },
        paymentRecords: { orderBy: { createdAt: 'desc' }, take: 20 },
        creditLedger: { orderBy: { createdAt: 'desc' }, take: 50 },
        adminNotes: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    }),
    prisma.creditLedger.aggregate({
      where: { userId },
      _sum: { amount: true },
    }),
  ])
  if (!user) notFound()

  const creditBalance = creditBalanceResult._sum.amount || 0
  const accountStatus = user.accountStatus || 'active'

  return (
    <>
      <AdminPageHeader title={user.email} description={`가입일 ${formatDate(user.createdAt)} · 플랜 ${formatPlan(user.plan)}`} />

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Section title="기본 정보">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Info label="이름" value={user.name || '-'} />
              <Info label="플랜" value={formatPlan(user.plan, true)} />
              <Info label="계정 상태" value={accountStatus} />
              <Info label="크레딧 잔액" value={`${creditBalance}개`} />
              <Info label="가입일" value={formatDate(user.createdAt)} />
              <Info label="최종 수정" value={formatDate(user.updatedAt)} />
              <Info label="Polar 구독 상태" value={user.polarSubscriptionStatus || '-'} />
              <Info label="Polar 구독 ID" value={user.polarSubscriptionId || '-'} />
            </dl>
          </Section>

          <Section title="생성 내역">
            {user.campaigns.length === 0 ? <EmptyState>생성 내역이 없습니다.</EmptyState> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left">
                  <thead className="border-b border-[#f0f0f0]">
                    <tr><Th>제목</Th><Th>생성 시각</Th><Th>상태</Th><Th>슬라이드</Th><Th>모델</Th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#f5f5f5]">
                    {user.campaigns.map(campaign => (
                      <tr key={campaign.id} className="hover:bg-[#fafafa]">
                        <Td className="font-semibold">{campaign.title || '-'}</Td>
                        <Td className="text-[#888]">{formatDate(campaign.createdAt)}</Td>
                        <Td><span className={statusPill(campaign.status)}>{campaign.status}</span></Td>
                        <Td>{campaign.slides.length || campaign.slideCount}장</Td>
                        <Td className="text-[#888]">{campaign.imageModel || '-'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="내부 결제 기록">
            {user.paymentRecords.length === 0 ? <EmptyState>결제 내역이 없습니다.</EmptyState> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left">
                  <thead className="border-b border-[#f0f0f0]">
                    <tr><Th>주문 ID</Th><Th>공급자</Th><Th>금액</Th><Th>환불액</Th><Th>상태</Th><Th>결제일</Th><Th>환불일</Th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#f5f5f5]">
                    {user.paymentRecords.map(p => (
                      <tr key={p.id} className="hover:bg-[#fafafa]">
                        <Td className="font-mono text-xs">{p.orderId}</Td>
                        <Td>{p.provider}</Td>
                        <Td className="font-semibold">{formatCurrency(p.amount, p.currency)}</Td>
                        <Td className="font-semibold text-red-600">{p.refundedAmount > 0 ? formatCurrency(p.refundedAmount, p.currency) : '-'}</Td>
                        <Td><span className={statusPill(p.status)}>{p.status}</span></Td>
                        <Td className="text-[#888]">{formatDate(p.paidAt)}</Td>
                        <Td className="text-[#888]">{formatDate(p.refundedAt)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="크레딧 원장">
            {user.creditLedger.length === 0 ? <EmptyState>크레딧 기록이 없습니다.</EmptyState> : (
              <div className="space-y-2">
                {user.creditLedger.map(entry => (
                  <div key={entry.id} className="flex items-start justify-between gap-3 rounded-lg border border-[#f0f0f0] p-3 text-sm">
                    <div>
                      <span className={`font-black ${entry.amount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {entry.amount > 0 ? '+' : ''}{entry.amount}
                      </span>
                      <span className="ml-2 text-[#888]">{entry.type} · {entry.reason || '사유 없음'}</span>
                      {entry.adminEmail && <div className="mt-0.5 text-[11px] text-[#bbb]">by {entry.adminEmail}</div>}
                    </div>
                    <span className="shrink-0 text-xs text-[#bbb]">{formatDate(entry.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="내부 메모">
            {user.adminNotes.length === 0 ? <EmptyState>작성된 메모가 없습니다.</EmptyState> : (
              <div className="space-y-3">
                {user.adminNotes.map(note => (
                  <div key={note.id} className="rounded-lg bg-[#fafafa] p-3 text-sm">
                    <p className="whitespace-pre-line leading-6">{note.content}</p>
                    <p className="mt-2 text-xs text-[#bbb]">{note.adminEmail} · {formatDate(note.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-5">
          {user.polarSubscriptionId && (
            <Section title="Polar 구독 관리">
              <p className="mb-3 text-xs leading-5 text-red-600">
                즉시 해지는 Polar 구독 혜택을 바로 종료하고 사용자 플랜을 Free로 변경합니다.
              </p>
              <AdminPolarSubscriptionActions
                userId={user.id}
                subscriptionId={user.polarSubscriptionId}
              />
            </Section>
          )}

          <Section title="크레딧 수동 조정">
            <form action={addCreditsAction} className="space-y-2">
              <input type="hidden" name="userId" value={user.id} />
              <input name="amount" placeholder="수량 (예: 10 또는 -3)" className={inputCls} />
              <input name="reason" placeholder="사유" className={inputCls} />
              <button className={`${btnCls} w-full`}>크레딧 추가</button>
            </form>
          </Section>

          <Section title="플랜 수동 변경">
            <form action={changeUserPlanAction} className="space-y-2">
              <input type="hidden" name="userId" value={user.id} />
              <select name="plan" defaultValue={user.plan} className={inputCls}>
                {['FREE', 'PRO', 'UNLIMITED'].map(p => <option key={p} value={p}>{formatPlan(p, true)}</option>)}
              </select>
              <input name="reason" placeholder="변경 사유" className={inputCls} />
              <button className={`${btnCls} w-full`}>플랜 변경</button>
            </form>
          </Section>

          <Section title="계정 상태 변경">
            <form action={updateAccountStatusAction} className="space-y-2">
              <input type="hidden" name="userId" value={user.id} />
              <select name="status" defaultValue={accountStatus} className={inputCls}>
                <option value="active">활성 (active)</option>
                <option value="blocked">차단 (blocked)</option>
              </select>
              <input name="reason" placeholder="변경 사유" className={inputCls} />
              <button className={`${btnCls} w-full`}>상태 저장</button>
            </form>
          </Section>

          <Section title="내부 결제 기록 생성">
            <form action={createManualPaymentRecordAction} className="space-y-2">
              <input type="hidden" name="userId" value={user.id} />
              <input name="orderId" placeholder="주문 ID" className={inputCls} />
              <input name="amount" placeholder="금액 (KRW)" className={inputCls} />
              <input name="pgTransactionId" placeholder="PG 거래 ID" className={inputCls} />
              <select name="status" defaultValue="paid" className={inputCls}>
                {['paid', 'cancelled', 'partial_refund', 'failed'].map(s => <option key={s}>{s}</option>)}
              </select>
              <input name="internalNote" placeholder="내부 메모" className={inputCls} />
              <button className={`${btnCls} w-full`}>내부 기록 생성</button>
            </form>
          </Section>

          <Section title="내부 메모 추가">
            <form action={addAdminNoteAction} className="space-y-2">
              <input type="hidden" name="userId" value={user.id} />
              <textarea name="content" rows={4} placeholder="운영 메모를 작성하세요." className={`${inputCls} resize-none`} />
              <button className={`${btnCls} w-full`}>메모 저장</button>
            </form>
          </Section>
        </div>
      </div>
    </>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-[#bbb]">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  )
}
