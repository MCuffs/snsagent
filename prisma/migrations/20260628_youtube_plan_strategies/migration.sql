ALTER TABLE "YouTubeAutomationDay"
ADD COLUMN "selectedPlanStrategyKey" TEXT,
ADD COLUMN "planStrategySnapshotJson" TEXT,
ADD COLUMN "sceneRoleSequenceJson" TEXT,
ADD COLUMN "hookPattern" TEXT,
ADD COLUMN "endingPattern" TEXT;

CREATE INDEX "YouTubeAutomationDay_planStrategy_idx"
ON "YouTubeAutomationDay" ("projectId", "selectedPlanStrategyKey");
