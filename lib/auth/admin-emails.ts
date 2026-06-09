export const ADMIN_EMAILS = (process.env.SUPER_USER_EMAILS || 'alstnwjd0424@gmail.com,imhs1248@gmail.com,kanghiee616@gmail.com')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean)

export function isAdminEmail(email?: string | null) {
  return Boolean(email && ADMIN_EMAILS.includes(email.toLowerCase()))
}
