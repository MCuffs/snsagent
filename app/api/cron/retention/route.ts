import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '../../../../lib/db-service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return handleRetentionCleanup(request)
}

export async function POST(request: NextRequest) {
  return handleRetentionCleanup(request)
}

async function handleRetentionCleanup(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const deletedCount = await dbService.deleteExpiredCampaigns()
  return NextResponse.json({ success: true, deletedCount })
}
