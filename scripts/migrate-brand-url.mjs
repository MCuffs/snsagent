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
} catch { /* rely on existing env */ }

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } })

async function main() {
  console.log('Adding websiteUrl column to Brand table...')
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "websiteUrl" TEXT
  `)
  console.log('✓ Brand.websiteUrl column added (or already exists)')
  console.log('\n✅ Migration complete.')
}

main()
  .catch(e => { console.error('Migration failed:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
