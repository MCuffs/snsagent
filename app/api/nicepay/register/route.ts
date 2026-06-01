import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST() {
  return NextResponse.json(
    { error: 'Deprecated NicePay route. Use /api/nicepay/approve.' },
    { status: 410 },
  )
}
