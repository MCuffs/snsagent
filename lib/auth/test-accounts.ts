const TEST_EMAILS = [
  'alstnwjd0424@gmail.com',
  'imhs1248@gmail.com',
  'kanghiee616@gmail.com',
]

export function isTestAccount(email?: string | null): boolean {
  if (!email) return false
  return TEST_EMAILS.includes(email.toLowerCase().trim())
}
