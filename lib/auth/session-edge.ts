import { getSessionSigningSecret } from '../env'

export const SESSION_COOKIE_NAME = 'shuffla_session'

export async function readSessionEmailEdge(token: string | undefined, now = Date.now()) {
  if (!token) return null

  const [encodedEmail, expiresAtText, signature, extra] = token.split('.')
  if (!encodedEmail || !expiresAtText || !signature || extra) return null

  const expiresAt = Number(expiresAtText)
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return null

  let expected: string
  try {
    expected = await signEdge(`${encodedEmail}.${expiresAtText}`)
  } catch {
    return null
  }

  if (!constantTimeEqual(expected, signature)) return null

  try {
    const email = decodeBase64Url(encodedEmail)
    const normalizedEmail = email.trim().toLowerCase()
    return normalizedEmail.includes('@') ? normalizedEmail : null
  } catch {
    return null
  }
}

async function signEdge(payload: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(getSessionSigningSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return encodeBase64Url(new Uint8Array(signature))
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new TextDecoder().decode(bytes)
}

function constantTimeEqual(expected: string, provided: string) {
  if (expected.length !== provided.length) return false

  let mismatch = 0
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ provided.charCodeAt(index)
  }
  return mismatch === 0
}
