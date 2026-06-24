const DEFAULT_ADMIN_EMAILS = ['alstnwjd0424@gmail.com']

export const ADMIN_EMAILS = `${DEFAULT_ADMIN_EMAILS.join(',')},${process.env.SUPER_USER_EMAILS || ''}`
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean)

export function isAdminEmail(email?: string | null) {
  return Boolean(email && ADMIN_EMAILS.includes(email.toLowerCase()))
}
