/**
 * Adds persisted source background and typography customization fields to generated slides.
 *
 * Usage:
 *   DIRECT_URL="postgresql://..." node scripts/migrate-slide-customization.mjs
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
    ALTER TABLE "CarouselSlide"
      ADD COLUMN IF NOT EXISTS "backgroundImageUrl" TEXT,
      ADD COLUMN IF NOT EXISTS "fontPreset" TEXT,
      ADD COLUMN IF NOT EXISTS "textColor" TEXT,
      ADD COLUMN IF NOT EXISTS "headlineFontSize" INTEGER,
      ADD COLUMN IF NOT EXISTS "bodyFontSize" INTEGER,
      ADD COLUMN IF NOT EXISTS "editorDocument" TEXT;
  `)

  const requiredColumns = [
    'backgroundImageUrl',
    'fontPreset',
    'textColor',
    'headlineFontSize',
    'bodyFontSize',
    'editorDocument',
  ]
  const columns = await prisma.$queryRawUnsafe(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'CarouselSlide'
      AND column_name IN (${requiredColumns.map(column => `'${column}'`).join(', ')})
  `)
  const availableColumns = new Set(columns.map(column => column.column_name))
  const missingColumns = requiredColumns.filter(column => !availableColumns.has(column))
  if (missingColumns.length > 0) {
    throw new Error(`Missing slide customization columns after migration: ${missingColumns.join(', ')}`)
  }
  console.log('Slide customization fields are ready.')
} finally {
  await prisma.$disconnect()
}
