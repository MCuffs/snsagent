import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../actions'
import prisma from '../../../../lib/db'
import { createMcpApiKey, hashMcpApiKey } from '../../../../lib/auth/mcp-api-key'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { mcpApiKey: true, mcpApiKeyHash: true },
  })

  return NextResponse.json({ key: null, hasKey: Boolean(row?.mcpApiKeyHash || row?.mcpApiKey) })
}

export async function POST() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = createMcpApiKey()

  await prisma.user.update({
    where: { id: user.id },
    data: {
      mcpApiKey: null,
      mcpApiKeyHash: hashMcpApiKey(key),
    },
  })

  return NextResponse.json({ key, hasKey: true })
}

export async function DELETE() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.user.update({
    where: { id: user.id },
    data: { mcpApiKey: null, mcpApiKeyHash: null },
  })

  return NextResponse.json({ ok: true })
}
