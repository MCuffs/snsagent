import { NextResponse } from 'next/server'
import { hasMetaOAuthConfig } from '../../../../../lib/meta/oauth'
import { isInstagramMockMode } from '../../../../../lib/env'

export const runtime = 'nodejs'

export async function GET() {
  const hasOAuth = hasMetaOAuthConfig()
  const mockMode = isInstagramMockMode()
  
  return NextResponse.json({
    hasOAuth,
    mockMode,
    canConnect: hasOAuth || mockMode,
  })
}
