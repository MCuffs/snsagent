ALTER TABLE "CarouselSlide"
ADD COLUMN "mediaType" TEXT NOT NULL DEFAULT 'image',
ADD COLUMN "videoUrl" TEXT,
ADD COLUMN "videoThumbnailUrl" TEXT,
ADD COLUMN "videoStartSec" DOUBLE PRECISION,
ADD COLUMN "videoDurationSec" DOUBLE PRECISION;

-- Backfill existing Seedance campaigns without relying on URL file extensions.
UPDATE "CarouselSlide" AS slide
SET
  "mediaType" = 'video',
  "videoUrl" = COALESCE(slide."videoUrl", slide."imageUrl"),
  "videoStartSec" = COALESCE(slide."videoStartSec", 0),
  "videoDurationSec" = COALESCE(slide."videoDurationSec", 5)
FROM "Campaign" AS campaign
WHERE slide."campaignId" = campaign."id"
  AND campaign."imageModel" LIKE '%seedance%';
