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
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AiGenerationLog_userId_fkey'
  ) THEN
    ALTER TABLE "AiGenerationLog"
      ADD CONSTRAINT "AiGenerationLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
