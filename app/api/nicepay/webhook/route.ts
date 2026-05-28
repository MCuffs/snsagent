export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  console.log('[NicePay Webhook]', JSON.stringify(body))
  return Response.json({ success: true })
}
