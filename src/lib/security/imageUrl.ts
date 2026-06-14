const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^0\./,
  /^\[?::1\]?$/i,
]

const TRUSTED_REMOTE_SUFFIXES = [
  '.public.blob.vercel-storage.com',
  '.pexels.com',
  '.wikimedia.org',
  '.unsplash.com',
]

const TRUSTED_REMOTE_HOSTS = [
  'images.pexels.com',
  'images.unsplash.com',
  'upload.wikimedia.org',
  'commons.wikimedia.org',
]

export function isTrustedRenderableImageUrl(value: string) {
  if (!value) return false
  if (value.startsWith('data:image/')) return true
  if (value.startsWith('/')) return !value.startsWith('//')
  if (value.startsWith('file://')) return false

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
    if (url.protocol === 'http:' && process.env.NODE_ENV === 'production') return false

    const hostname = url.hostname.toLowerCase()
    if (PRIVATE_HOST_PATTERNS.some(pattern => pattern.test(hostname))) return false

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
    if (appUrl) {
      try {
        if (new URL(appUrl).hostname.toLowerCase() === hostname) return true
      } catch {
        // Invalid app URL config should not expand the allowlist.
      }
    }

    return TRUSTED_REMOTE_HOSTS.includes(hostname) ||
      TRUSTED_REMOTE_SUFFIXES.some(suffix => hostname.endsWith(suffix))
  } catch {
    return false
  }
}
