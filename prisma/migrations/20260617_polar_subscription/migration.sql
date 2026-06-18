ALTER TABLE "User" ADD COLUMN "polarSubscriptionId" TEXT;
ALTER TABLE "User" ADD COLUMN "polarSubscriptionStatus" TEXT;
CREATE UNIQUE INDEX "User_polarSubscriptionId_key" ON "User"("polarSubscriptionId");
