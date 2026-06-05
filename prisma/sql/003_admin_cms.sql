CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accountStatus" TEXT NOT NULL DEFAULT 'active';

CREATE TABLE IF NOT EXISTS "AdminNote" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "adminEmail" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "CreditLedger" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "reason" TEXT,
  "adminEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PaymentRecord" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'manual',
  "amount" INTEGER NOT NULL DEFAULT 0,
  "pgTransactionId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'paid',
  "paidAt" TIMESTAMP(3),
  "refundedAt" TIMESTAMP(3),
  "refundReason" TEXT,
  "internalNote" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AdminActionLog" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "adminEmail" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "reason" TEXT,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentRecord_orderId_key" ON "PaymentRecord"("orderId");
CREATE INDEX IF NOT EXISTS "AdminNote_userId_createdAt_idx" ON "AdminNote"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminNote_adminEmail_idx" ON "AdminNote"("adminEmail");
CREATE INDEX IF NOT EXISTS "CreditLedger_userId_createdAt_idx" ON "CreditLedger"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "CreditLedger_type_idx" ON "CreditLedger"("type");
CREATE INDEX IF NOT EXISTS "PaymentRecord_userId_createdAt_idx" ON "PaymentRecord"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "PaymentRecord_status_idx" ON "PaymentRecord"("status");
CREATE INDEX IF NOT EXISTS "PaymentRecord_paidAt_idx" ON "PaymentRecord"("paidAt");
CREATE INDEX IF NOT EXISTS "AdminActionLog_adminEmail_createdAt_idx" ON "AdminActionLog"("adminEmail", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminActionLog_targetType_targetId_idx" ON "AdminActionLog"("targetType", "targetId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminNote_userId_fkey') THEN
    ALTER TABLE "AdminNote" ADD CONSTRAINT "AdminNote_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CreditLedger_userId_fkey') THEN
    ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentRecord_userId_fkey') THEN
    ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
