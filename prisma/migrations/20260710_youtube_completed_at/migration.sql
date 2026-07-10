ALTER TABLE "YouTubeAutomationDay"
ADD COLUMN "completedAt" TIMESTAMP(3);

UPDATE "YouTubeAutomationDay"
SET "completedAt" = "updatedAt"
WHERE "status" IN ('completed', 'uploaded')
  AND "mp4Url" IS NOT NULL;
