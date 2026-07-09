#!/usr/bin/env node
/**
 * Instagram Token Encryption Migration Script
 * 
 * This script migrates legacy base64-encoded Instagram tokens to the new
 * AES-256-GCM encrypted format (v1: prefix).
 * 
 * Usage:
 *   node scripts/migrate-instagram-tokens.js
 * 
 * Safety:
 *   - Creates a backup file before any changes
 *   - Only migrates tokens that are NOT already encrypted (missing v1: prefix)
 *   - Can be run multiple times safely (idempotent)
 *   - Dry-run mode available: DRY_RUN=true node scripts/migrate-instagram-tokens.js
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DRY_RUN = process.env.DRY_RUN === 'true';
const BACKUP_DIR = path.join(process.cwd(), 'backups');

function getTokenEncryptionSecret() {
  const secret = process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY;
  if (!secret || secret === 'replace-with-a-long-random-secret') {
    console.error('❌ ERROR: INSTAGRAM_TOKEN_ENCRYPTION_KEY must be set to a strong secret');
    console.error('   Set it in your .env file or as an environment variable');
    process.exit(1);
  }
  return secret;
}

function getTokenEncryptionKey() {
  return crypto.createHash('sha256').update(getTokenEncryptionSecret()).digest();
}

function encryptToken(token) {
  if (!token) return '';
  
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getTokenEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

function decryptLegacyToken(encoded) {
  if (!encoded) return '';
  return Buffer.from(encoded, 'base64').toString('utf8');
}

function isLegacyToken(token) {
  return token && !token.startsWith('v1:');
}

async function createBackup(prisma) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `instagram-tokens-${timestamp}.json`);
  
  console.log('📦 Creating backup...');
  
  const accounts = await prisma.instagramAccount.findMany({
    select: {
      id: true,
      brandId: true,
      accessTokenEncrypted: true,
      pageAccessTokenEncrypted: true,
    }
  });
  
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  fs.writeFileSync(backupFile, JSON.stringify(accounts, null, 2));
  console.log(`✅ Backup created: ${backupFile}`);
  console.log(`   ${accounts.length} Instagram accounts backed up`);
  
  return backupFile;
}

async function main() {
  console.log('🔐 Instagram Token Encryption Migration\n');
  
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  const prisma = new PrismaClient();
  
  try {
    // Step 1: Create backup
    const backupFile = await createBackup(prisma);
    
    // Step 2: Find accounts with legacy tokens
    console.log('\n🔍 Scanning for legacy tokens...');
    const accounts = await prisma.instagramAccount.findMany({
      select: {
        id: true,
        brandId: true,
        accessTokenEncrypted: true,
        pageAccessTokenEncrypted: true,
      }
    });
    
    const legacyAccounts = accounts.filter(acc => 
      isLegacyToken(acc.accessTokenEncrypted) || 
      isLegacyToken(acc.pageAccessTokenEncrypted)
    );
    
    console.log(`   Found ${accounts.length} total Instagram accounts`);
    console.log(`   Found ${legacyAccounts.length} accounts with legacy tokens`);
    
    if (legacyAccounts.length === 0) {
      console.log('\n✅ All tokens are already encrypted. Nothing to migrate.');
      return;
    }
    
    // Step 3: Migrate tokens
    console.log(`\n${DRY_RUN ? '🔍 Would migrate' : '🔄 Migrating'} ${legacyAccounts.length} accounts...`);
    
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const account of legacyAccounts) {
      try {
        const updates = {};
        
        // Migrate access token
        if (isLegacyToken(account.accessTokenEncrypted)) {
          const plainToken = decryptLegacyToken(account.accessTokenEncrypted);
          updates.accessTokenEncrypted = encryptToken(plainToken);
          console.log(`   ${DRY_RUN ? 'Would migrate' : 'Migrating'} access token for account ${account.id}`);
        }
        
        // Migrate page access token
        if (isLegacyToken(account.pageAccessTokenEncrypted)) {
          const plainToken = decryptLegacyToken(account.pageAccessTokenEncrypted);
          updates.pageAccessTokenEncrypted = encryptToken(plainToken);
          console.log(`   ${DRY_RUN ? 'Would migrate' : 'Migrating'} page access token for account ${account.id}`);
        }
        
        // Update database
        if (!DRY_RUN && Object.keys(updates).length > 0) {
          await prisma.instagramAccount.update({
            where: { id: account.id },
            data: updates
          });
        }
        
        migratedCount++;
      } catch (error) {
        console.error(`   ❌ Error migrating account ${account.id}:`, error.message);
        errorCount++;
      }
    }
    
    // Step 4: Summary
    console.log('\n📊 Migration Summary:');
    console.log(`   ${DRY_RUN ? 'Would migrate' : 'Migrated'}: ${migratedCount} accounts`);
    console.log(`   Errors: ${errorCount} accounts`);
    console.log(`   Already encrypted: ${accounts.length - legacyAccounts.length} accounts`);
    
    if (!DRY_RUN && migratedCount > 0) {
      console.log(`\n✅ Migration completed successfully!`);
      console.log(`   Backup saved to: ${backupFile}`);
    } else if (DRY_RUN) {
      console.log('\n✅ Dry run completed. Run without DRY_RUN=true to apply changes.');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
