import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '../../../../lib/db-service'
import { unauthorizedJson, verifyBearerSecret } from '../../../../lib/security'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return handleRetentionCleanup(request)
}

export async function POST(request: NextRequest) {
  return handleRetentionCleanup(request)
}

async function handleRetentionCleanup(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!verifyBearerSecret(request.headers.get('authorization'), secret)) {
    return unauthorizedJson()
  }

  const deletedCount = await dbService.deleteExpiredCampaigns()
  return NextResponse.json({ success: true, deletedCount })
}
