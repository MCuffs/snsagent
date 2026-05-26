/**
 * Adds Toss Payments billing fields while retaining legacy provider fields during rollout.
 *
 * Existing deployments can still select Naver Pay columns until the Toss/PayPal
 * release is deployed. These compatibility columns avoid login outages while
 * the code and schema transition independently.
 *
 * Usage:
 *   DIRECT_URL="postgresql://..." node scripts/migrate-tosspayments.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { PrismaClient } from '@prisma/client'

function loadDotEnv() {
  const file = path.join(process.cwd(), '.env')
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
}

loadDotEnv()

const url = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!url) {
  console.error('DIRECT_URL or DATABASE_URL is required.')
  process.exit(1)
}

const prisma = new PrismaClient({ datasources: { db: { url } } })

try {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
      ADD COLUMN IF NOT EXISTS "naverpayRecurrentId" TEXT,
      ADD COLUMN IF NOT EXISTS "naverpaySubscriptionStatus" TEXT,
      ADD COLUMN IF NOT EXISTS "tossCustomerKey" TEXT,
      ADD COLUMN IF NOT EXISTS "tossBillingKey" TEXT,
      ADD COLUMN IF NOT EXISTS "tossPaymentKey" TEXT,
      ADD COLUMN IF NOT EXISTS "tossLastOrderId" TEXT,
      ADD COLUMN IF NOT EXISTS "tossSubscriptionStatus" TEXT,
      ADD COLUMN IF NOT EXISTS "tossNextBillingAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "tossLastPaidAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "tossCanceledAt" TIMESTAMP(3);
  `)
  for (const field of [
    'naverpayRecurrentId',
    'tossCustomerKey',
    'tossBillingKey',
    'tossPaymentKey',
    'tossLastOrderId',
  ]) {
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "User_${field}_key" ON "User"("${field}");
    `)
  }
  const requiredColumns = [
    'naverpayRecurrentId',
    'naverpaySubscriptionStatus',
    'tossCustomerKey',
    'tossBillingKey',
    'tossPaymentKey',
    'tossLastOrderId',
    'tossSubscriptionStatus',
    'tossNextBillingAt',
    'tossLastPaidAt',
    'tossCanceledAt',
  ]
  const columns = await prisma.$queryRawUnsafe(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'User'
      AND column_name IN (${requiredColumns.map(column => `'${column}'`).join(', ')})
  `)
  const availableColumns = new Set(columns.map(column => column.column_name))
  const missingColumns = requiredColumns.filter(column => !availableColumns.has(column))
  if (missingColumns.length > 0) {
    throw new Error(`Missing billing columns after migration: ${missingColumns.join(', ')}`)
  }
  console.log('Billing compatibility and Toss Payments fields are ready.')
} finally {
  await prisma.$disconnect()
}
