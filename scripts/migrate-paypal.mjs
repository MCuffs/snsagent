/**
 * Safely adds PayPal columns to the User table using raw SQL.
 * Uses IF NOT EXISTS so it's idempotent.
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Load .env manually without dotenv
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env')
try {
  const envContent = readFileSync(envPath, 'utf8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val = trimmed.slice(eqIdx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
} catch { /* .env not found, rely on existing env */ }

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } })

async function main() {
  console.log('Adding PayPal columns to User table...')

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "paypalSubscriptionId" TEXT,
    ADD COLUMN IF NOT EXISTS "paypalSubscriptionStatus" TEXT
  `)
  console.log('✓ Columns added (or already exist)')

  // Add unique constraint only if it doesn't exist yet
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'User_paypalSubscriptionId_key'
      ) THEN
        ALTER TABLE "User"
        ADD CONSTRAINT "User_paypalSubscriptionId_key"
        UNIQUE ("paypalSubscriptionId");
      END IF;
    END;
    $$
  `)
  console.log('✓ Unique constraint on paypalSubscriptionId ensured')

  console.log('\n✅ Migration complete. Run `npx prisma generate` to update the client if needed.')
}

main()
  .catch(e => { console.error('Migration failed:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
