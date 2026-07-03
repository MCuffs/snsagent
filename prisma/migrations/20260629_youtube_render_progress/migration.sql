ALTER TABLE "YouTubeAutomationDay"
ADD COLUMN "renderProgress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "renderStage" TEXT,
ADD COLUMN "renderCancelRequested" BOOLEAN NOT NULL DEFAULT false;
