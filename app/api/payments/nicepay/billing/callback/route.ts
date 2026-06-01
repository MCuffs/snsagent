import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json(
    { error: 'Deprecated NicePay callback route. Use /api/nicepay/approve.' },
    { status: 410 },
  )
}
