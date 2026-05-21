import crypto from 'crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../actions'
import { dbService } from '../../../../../lib/db-service'
import { buildMetaOAuthUrl, hasMetaOAuthConfig } from '../../../../../lib/meta/oauth'

export const runtime = 'nodejs'

interface MetaOAuthState {
  nonce: string
  brandId: string
}

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const brands = await dbService.getBrands(user.id)
  const requestedBrandId = new URL(request.url).searchParams.get('brandId')
  const brand = requestedBrandId
    ? brands.find(item => item.id === requestedBrandId)
    : brands[0]

  if (!brand) {
    return NextResponse.redirect(new URL('/brand', request.url))
  }

  if (!hasMetaOAuthConfig()) {
    return NextResponse.redirect(new URL('/instagram?error=meta_config_missing', request.url))
  }

  const nonce = crypto.randomBytes(16).toString('hex')
  const state = encodeState({ nonce, brandId: brand.id })
  const cookieStore = await cookies()
  cookieStore.set('meta_oauth_nonce', nonce, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  })

  return NextResponse.redirect(buildMetaOAuthUrl({ request, state }))
}

function encodeState(state: MetaOAuthState) {
  return Buffer.from(JSON.stringify(state), 'utf8').toString('base64url')
}
