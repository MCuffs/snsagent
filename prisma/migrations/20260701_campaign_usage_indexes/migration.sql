CREATE INDEX IF NOT EXISTS "Campaign_userId_createdAt_idx"
  ON "Campaign" ("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "Campaign_userId_mediaType_createdAt_idx"
  ON "Campaign" ("userId", "mediaType", "createdAt");
