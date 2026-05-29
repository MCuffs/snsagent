import { NextResponse } from 'next/server'

// Server 승인 방식에서는 returnUrl이 호출되지 않음.
// AUTHNICE.requestPay의 returnUrl 필드가 필수라 등록만 해둔 dummy 엔드포인트.
export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST() {
  return NextResponse.json({ ok: true })
}
