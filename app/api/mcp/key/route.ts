import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ key: null, unavailable: true })
}

export async function POST() {
  return NextResponse.json({ error: 'API key feature coming soon' }, { status: 503 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'API key feature coming soon' }, { status: 503 })
}
