import { timingSafeEqual } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  const configuredSecret = process.env.MIGRATION_SECRET;
  const providedSecret = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!configuredSecret || !providedSecret) return false;

  const expected = Buffer.from(configuredSecret);
  const provided = Buffer.from(providedSecret);
  return (
    expected.length === provided.length && timingSafeEqual(expected, provided)
  );
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json(
      { success: false, error: "Migration database URL is unavailable." },
      { status: 500 },
    );
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    await prisma.$executeRawUnsafe(`
        ALTER TABLE "User"
          ADD COLUMN IF NOT EXISTS "paypalSubscriptionId" TEXT,
          ADD COLUMN IF NOT EXISTS "paypalSubscriptionStatus" TEXT,
          ADD COLUMN IF NOT EXISTS "naverpayRecurrentId" TEXT,
          ADD COLUMN IF NOT EXISTS "naverpaySubscriptionStatus" TEXT,
          ADD COLUMN IF NOT EXISTS "tossCustomerKey" TEXT,
          ADD COLUMN IF NOT EXISTS "tossBillingKey" TEXT,
          ADD COLUMN IF NOT EXISTS "tossPaymentKey" TEXT,
          ADD COLUMN IF NOT EXISTS "tossLastOrderId" TEXT,
          ADD COLUMN IF NOT EXISTS "tossSubscriptionStatus" TEXT,
          ADD COLUMN IF NOT EXISTS "tossNextBillingAt" TIMESTAMP(3),
          ADD COLUMN IF NOT EXISTS "tossLastPaidAt" TIMESTAMP(3),
          ADD COLUMN IF NOT EXISTS "tossCanceledAt" TIMESTAMP(3);
      `);
    for (const field of [
      "paypalSubscriptionId",
      "naverpayRecurrentId",
      "tossCustomerKey",
      "tossBillingKey",
      "tossPaymentKey",
      "tossLastOrderId",
    ]) {
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "User_${field}_key" ON "User"("${field}");`,
      );
    }
    await prisma.$executeRawUnsafe(`
        ALTER TABLE "Brand"
          ADD COLUMN IF NOT EXISTS "websiteUrl" TEXT,
          ADD COLUMN IF NOT EXISTS "brandDna" TEXT,
          ADD COLUMN IF NOT EXISTS "editorPreferences" TEXT;
      `);
    await prisma.$executeRawUnsafe(`
        ALTER TABLE "Campaign"
          ADD COLUMN IF NOT EXISTS "agentReport" TEXT,
          ADD COLUMN IF NOT EXISTS "imageModel" TEXT,
          ADD COLUMN IF NOT EXISTS "initialImageCount" INTEGER NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS "regenerationImageCount" INTEGER NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS "lastRegenerationImageModel" TEXT;
      `);
    await prisma.$executeRawUnsafe(`
        ALTER TABLE "CarouselSlide"
          ADD COLUMN IF NOT EXISTS "backgroundImageUrl" TEXT,
          ADD COLUMN IF NOT EXISTS "fontPreset" TEXT,
          ADD COLUMN IF NOT EXISTS "textColor" TEXT,
          ADD COLUMN IF NOT EXISTS "headlineFontSize" INTEGER,
          ADD COLUMN IF NOT EXISTS "bodyFontSize" INTEGER,
          ADD COLUMN IF NOT EXISTS "editorDocument" TEXT;
      `);
    await prisma.$executeRawUnsafe(`
        ALTER TABLE "InstagramAccount"
          ADD COLUMN IF NOT EXISTS "facebookPageId" TEXT,
          ADD COLUMN IF NOT EXISTS "pageAccessTokenEncrypted" TEXT,
          ADD COLUMN IF NOT EXISTS "tokenExpiresAt" TIMESTAMP(3),
          ADD COLUMN IF NOT EXISTS "username" TEXT,
          ADD COLUMN IF NOT EXISTS "profilePictureUrl" TEXT,
          ADD COLUMN IF NOT EXISTS "connectionMethod" TEXT NOT NULL DEFAULT 'manual';
      `);
    await prisma.user.findFirst();
    await prisma.brand.findFirst();
    await prisma.campaign.findFirst();
    await prisma.carouselSlide.findFirst();

    return NextResponse.json({
      success: true,
      message: "Schema migration applied.",
    });
  } catch (error) {
    console.error("[Schema migration]", error);
    return NextResponse.json(
      {
        success: false,
        error: "Schema migration failed.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
