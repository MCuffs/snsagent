ALTER TABLE "PaymentRecord" ADD COLUMN "providerSubscriptionId" TEXT;
ALTER TABLE "PaymentRecord" ADD COLUMN "providerProductId" TEXT;
ALTER TABLE "PaymentRecord" ADD COLUMN "customerEmail" TEXT;
ALTER TABLE "PaymentRecord" ADD COLUMN "providerMetadata" TEXT;

CREATE INDEX "PaymentRecord_provider_idx" ON "PaymentRecord"("provider");
CREATE INDEX "PaymentRecord_providerSubscriptionId_idx" ON "PaymentRecord"("providerSubscriptionId");
