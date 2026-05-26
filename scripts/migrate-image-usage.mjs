/**
 * Adds campaign image-generation accounting fields for existing PostgreSQL deployments.
 * Uses IF NOT EXISTS so the script can be run safely during repeated deployments.
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

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
} catch {
  // Rely on environment variables when there is no local .env file.
}

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DIRECT_URL or DATABASE_URL is required.')
  process.exit(1)
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Campaign"
    ADD COLUMN IF NOT EXISTS "imageModel" TEXT,
    ADD COLUMN IF NOT EXISTS "initialImageCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "regenerationImageCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "lastRegenerationImageModel" TEXT
  `)
  console.log('Campaign image usage columns added or already present.')
}

main()
  .catch(error => {
    console.error('Migration failed:', error.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
