ALTER TABLE "YouTubeAutomationDay"
ADD COLUMN "selectedTemplateKey" TEXT,
ADD COLUMN "templateVersion" INTEGER,
ADD COLUMN "templateSnapshotJson" TEXT,
ADD COLUMN "classifierResultJson" TEXT,
ADD COLUMN "usedDefaultTemplate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "selectionReason" TEXT,
ADD COLUMN "videoStructureJson" TEXT;

CREATE TABLE "YouTubeShortsTemplate" (
  "id" TEXT NOT NULL,
  "templateName" TEXT NOT NULL,
  "templateKey" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "layoutConfig" TEXT NOT NULL DEFAULT '{}',
  "headerStyle" TEXT NOT NULL DEFAULT '{}',
  "captionStyle" TEXT NOT NULL DEFAULT '{}',
  "videoRules" TEXT NOT NULL DEFAULT '{}',
  "ctaConfig" TEXT NOT NULL DEFAULT '{}',
  "aiMatchingConfig" TEXT NOT NULL DEFAULT '{}',
  "overlayConfig" TEXT NOT NULL DEFAULT '{}',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "YouTubeShortsTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "YouTubeShortsTemplate_templateKey_key"
ON "YouTubeShortsTemplate"("templateKey");
CREATE INDEX "YouTubeShortsTemplate_isActive_category_idx"
ON "YouTubeShortsTemplate"("isActive", "category");
CREATE INDEX "YouTubeShortsTemplate_isDefault_idx"
ON "YouTubeShortsTemplate"("isDefault");
CREATE UNIQUE INDEX "YouTubeShortsTemplate_one_active_default"
ON "YouTubeShortsTemplate" ("isDefault")
WHERE "isDefault" = true AND "isActive" = true;
