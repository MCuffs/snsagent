-- Migration: add missing User columns and new tables
-- Run this in Supabase SQL Editor if automatic migration fails

-- 1. Nicepay fields on User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nicepayBid" TEXT UNIQUE;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nicepaySubscriptionStatus" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nicepayNextBillingAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nicepayLastPaidAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nicepayCanceledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nicepayLastOrderId" TEXT UNIQUE;

-- 2. AiGenerationLog table (see 002_ai_generation_log.sql for full definition)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "AiGenerationLog" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT,
  "campaignId" TEXT,
  "brandId" TEXT,
  "stepName" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "model" TEXT,
  "baseURL" TEXT,
  "keyFingerprint" TEXT,
  "promptTokens" INTEGER,
  "completionTokens" INTEGER,
  "totalTokens" INTEGER,
  "errorStatus" INTEGER,
  "errorCode" TEXT,
  "errorType" TEXT,
  "errorMessage" TEXT,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AiGenerationLog_createdAt_idx" ON "AiGenerationLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AiGenerationLog_userId_createdAt_idx" ON "AiGenerationLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiGenerationLog_stepName_status_idx" ON "AiGenerationLog"("stepName", "status");
CREATE INDEX IF NOT EXISTS "AiGenerationLog_model_idx" ON "AiGenerationLog"("model");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AiGenerationLog_userId_fkey') THEN
    ALTER TABLE "AiGenerationLog"
      ADD CONSTRAINT "AiGenerationLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Template table
CREATE TABLE IF NOT EXISTS "Template" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "document" TEXT NOT NULL,
  "slideNumber" INTEGER,
  "thumbnail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Template_userId_idx" ON "Template"("userId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Template_userId_fkey') THEN
    ALTER TABLE "Template"
      ADD CONSTRAINT "Template_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
