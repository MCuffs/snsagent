-- YouTube automation planner and day-by-day production state.

CREATE TABLE "YouTubeAutomationProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "currentOpenDay" INTEGER NOT NULL DEFAULT 1,
    "planJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YouTubeAutomationProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "YouTubeAutomationDay" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT,
    "dayNumber" INTEGER NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'locked',
    "script" TEXT,
    "description" TEXT,
    "tagsJson" TEXT,
    "pinnedComment" TEXT,
    "scenesJson" TEXT,
    "sourceClipsJson" TEXT,
    "ttsProvider" TEXT,
    "ttsAudioUrl" TEXT,
    "subtitleJson" TEXT,
    "mp4Url" TEXT,
    "thumbnailUrl" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YouTubeAutomationDay_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "YouTubeAutomationProject_userId_createdAt_idx" ON "YouTubeAutomationProject"("userId", "createdAt");
CREATE INDEX "YouTubeAutomationProject_status_idx" ON "YouTubeAutomationProject"("status");
CREATE UNIQUE INDEX "YouTubeAutomationDay_projectId_dayNumber_key" ON "YouTubeAutomationDay"("projectId", "dayNumber");
CREATE INDEX "YouTubeAutomationDay_userId_scheduledDate_idx" ON "YouTubeAutomationDay"("userId", "scheduledDate");
CREATE INDEX "YouTubeAutomationDay_status_idx" ON "YouTubeAutomationDay"("status");
CREATE INDEX "YouTubeAutomationDay_campaignId_idx" ON "YouTubeAutomationDay"("campaignId");

ALTER TABLE "YouTubeAutomationProject"
  ADD CONSTRAINT "YouTubeAutomationProject_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "YouTubeAutomationDay"
  ADD CONSTRAINT "YouTubeAutomationDay_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "YouTubeAutomationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "YouTubeAutomationDay"
  ADD CONSTRAINT "YouTubeAutomationDay_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "YouTubeAutomationDay"
  ADD CONSTRAINT "YouTubeAutomationDay_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
