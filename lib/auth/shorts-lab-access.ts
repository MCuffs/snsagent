const SHORTS_LAB_ADMIN_EMAILS = new Set([
  'alstnwjd0424@gmail.com',
])

export function canAccessShortsLab(email?: string | null) {
  return Boolean(email && SHORTS_LAB_ADMIN_EMAILS.has(email.trim().toLowerCase()))
}
