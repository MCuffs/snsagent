-- Add mediaType column to Campaign (already exists in production DB, this syncs schema)
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "mediaType" TEXT DEFAULT 'image';
