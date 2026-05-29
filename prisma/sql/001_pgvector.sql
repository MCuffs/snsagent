-- Run this in Supabase SQL Editor BEFORE running prisma db push
-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. After running prisma db push, run this to add vector indexes (once you have data)
-- CREATE INDEX ON "CrawledPost" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- CREATE INDEX ON "ViralCopyPattern" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- CREATE INDEX ON "TrendSignal" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- CREATE INDEX ON "SummarizedPreference" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
