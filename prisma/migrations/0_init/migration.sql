-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "accountStatus" TEXT NOT NULL DEFAULT 'active',
    "paypalSubscriptionId" TEXT,
    "paypalSubscriptionStatus" TEXT,
    "tossCustomerKey" TEXT,
    "tossBillingKey" TEXT,
    "tossPaymentKey" TEXT,
    "tossLastOrderId" TEXT,
    "tossSubscriptionStatus" TEXT,
    "tossNextBillingAt" TIMESTAMP(3),
    "tossLastPaidAt" TIMESTAMP(3),
    "tossCanceledAt" TIMESTAMP(3),
    "nicepayBid" TEXT,
    "nicepaySubscriptionStatus" TEXT,
    "nicepayNextBillingAt" TIMESTAMP(3),
    "nicepayLastPaidAt" TIMESTAMP(3),
    "nicepayCanceledAt" TIMESTAMP(3),
    "nicepayLastOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "toneOfVoice" TEXT NOT NULL,
    "mainColor" TEXT NOT NULL,
    "forbiddenWords" TEXT NOT NULL,
    "ctaStyle" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "brandDna" TEXT,
    "editorPreferences" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "facebookPageId" TEXT,
    "pageAccessTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "username" TEXT,
    "profilePictureUrl" TEXT,
    "connectionMethod" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productDescription" TEXT NOT NULL,
    "keyBenefits" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "slideCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "agentReport" TEXT,
    "imageModel" TEXT,
    "initialImageCount" INTEGER NOT NULL DEFAULT 0,
    "regenerationImageCount" INTEGER NOT NULL DEFAULT 0,
    "lastRegenerationImageModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarouselSlide" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "slideNumber" INTEGER NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "designPrompt" TEXT NOT NULL,
    "imageUrl" TEXT,
    "backgroundImageUrl" TEXT,
    "fontPreset" TEXT,
    "textColor" TEXT,
    "headlineFontSize" INTEGER,
    "bodyFontSize" INTEGER,
    "editorDocument" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarouselSlide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "hashtags" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "instagramMediaId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "slideNumber" INTEGER,
    "thumbnail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "actionName" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "errorStack" TEXT,
    "contextData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiGenerationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "campaignId" TEXT,
    "brandId" TEXT,
    "stepName" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "model" TEXT,
    "baseURL" TEXT,
    "keyFingerprint" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "errorStatus" INTEGER,
    "errorCode" TEXT,
    "errorType" TEXT,
    "errorMessage" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiGenerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "adminEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "amount" INTEGER NOT NULL DEFAULT 0,
    "pgTransactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'paid',
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "refundReason" TEXT,
    "internalNote" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminActionLog" (
    "id" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "reason" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawledPost" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "crawledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCarousel" BOOLEAN NOT NULL DEFAULT false,
    "carouselConfidence" DOUBLE PRECISION,
    "carouselType" TEXT,
    "slideCount" INTEGER,
    "estimatedLikes" INTEGER,
    "estimatedComments" INTEGER,
    "headlinePosition" TEXT,
    "headlineLength" INTEGER,
    "emotionSignal" TEXT,
    "designStyle" TEXT,
    "colorPalette" TEXT,
    "textDensity" TEXT,
    "trendKeywords" TEXT,
    "hashtags" TEXT,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrawledPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViralCopyPattern" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourcePlatform" TEXT,
    "analyzedAt" TIMESTAMP(3) NOT NULL,
    "headlineStyle" TEXT NOT NULL,
    "emotionalTrigger" TEXT NOT NULL,
    "detectedHookPattern" TEXT NOT NULL,
    "slideRole" TEXT NOT NULL,
    "layoutType" TEXT NOT NULL,
    "copyTone" TEXT NOT NULL,
    "extractedPatternNotes" TEXT NOT NULL,
    "engagementScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "industry" TEXT,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViralCopyPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendSignal" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "category" TEXT,
    "phase" TEXT NOT NULL DEFAULT 'emerging',
    "mentionCount" INTEGER NOT NULL DEFAULT 0,
    "velocityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "engagementProxy" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "associatedLayouts" TEXT,
    "associatedColors" TEXT,
    "associatedEmotions" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "peakAt" TIMESTAMP(3),
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrendSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "campaignId" TEXT,
    "slideId" TEXT,
    "eventType" TEXT NOT NULL,
    "editDelta" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserEditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SummarizedPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "preferredHookPatterns" TEXT,
    "preferredLayouts" TEXT,
    "preferredEmotions" TEXT,
    "preferredCopyTone" TEXT,
    "preferredColorStyle" TEXT,
    "avoidPatterns" TEXT,
    "summary" TEXT,
    "embedding" vector(1536),
    "compressedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editLogCountAtCompress" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SummarizedPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityScoreLog" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "score" INTEGER NOT NULL,
    "narrativeFlowScore" INTEGER NOT NULL,
    "personaFitScore" INTEGER NOT NULL,
    "hookPatternScore" INTEGER NOT NULL,
    "issueCount" INTEGER NOT NULL,
    "issuesJson" TEXT,
    "hookPatternUsed" TEXT,
    "personaUsed" TEXT,
    "industryUsed" TEXT,
    "trendContextUsed" BOOLEAN NOT NULL DEFAULT false,
    "memoryContextUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityScoreLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_paypalSubscriptionId_key" ON "User"("paypalSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tossCustomerKey_key" ON "User"("tossCustomerKey");    

-- CreateIndex
CREATE UNIQUE INDEX "User_tossBillingKey_key" ON "User"("tossBillingKey");      

-- CreateIndex
CREATE UNIQUE INDEX "User_tossPaymentKey_key" ON "User"("tossPaymentKey");      

-- CreateIndex
CREATE UNIQUE INDEX "User_tossLastOrderId_key" ON "User"("tossLastOrderId");    

-- CreateIndex
CREATE UNIQUE INDEX "User_nicepayBid_key" ON "User"("nicepayBid");

-- CreateIndex
CREATE UNIQUE INDEX "User_nicepayLastOrderId_key" ON "User"("nicepayLastOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramAccount_userId_key" ON "InstagramAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramAccount_brandId_key" ON "InstagramAccount"("brandId");

-- CreateIndex
CREATE INDEX "AiGenerationLog_createdAt_idx" ON "AiGenerationLog"("createdAt"); 

-- CreateIndex
CREATE INDEX "AiGenerationLog_userId_createdAt_idx" ON "AiGenerationLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiGenerationLog_stepName_status_idx" ON "AiGenerationLog"("stepName", "status");

-- CreateIndex
CREATE INDEX "AiGenerationLog_model_idx" ON "AiGenerationLog"("model");

-- CreateIndex
CREATE INDEX "AdminNote_userId_createdAt_idx" ON "AdminNote"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminNote_adminEmail_idx" ON "AdminNote"("adminEmail");

-- CreateIndex
CREATE INDEX "CreditLedger_userId_createdAt_idx" ON "CreditLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditLedger_type_idx" ON "CreditLedger"("type");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_orderId_key" ON "PaymentRecord"("orderId");  

-- CreateIndex
CREATE INDEX "PaymentRecord_userId_createdAt_idx" ON "PaymentRecord"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentRecord_status_idx" ON "PaymentRecord"("status");

-- CreateIndex
CREATE INDEX "PaymentRecord_paidAt_idx" ON "PaymentRecord"("paidAt");

-- CreateIndex
CREATE INDEX "AdminActionLog_adminEmail_createdAt_idx" ON "AdminActionLog"("adminEmail", "createdAt");

-- CreateIndex
CREATE INDEX "AdminActionLog_targetType_targetId_idx" ON "AdminActionLog"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "CrawledPost_sourceUrl_key" ON "CrawledPost"("sourceUrl");  

-- CreateIndex
CREATE INDEX "CrawledPost_platform_crawledAt_idx" ON "CrawledPost"("platform", "crawledAt");

-- CreateIndex
CREATE INDEX "CrawledPost_isCarousel_idx" ON "CrawledPost"("isCarousel");       

-- CreateIndex
CREATE INDEX "ViralCopyPattern_detectedHookPattern_idx" ON "ViralCopyPattern"("detectedHookPattern");

-- CreateIndex
CREATE INDEX "ViralCopyPattern_industry_idx" ON "ViralCopyPattern"("industry"); 

-- CreateIndex
CREATE INDEX "ViralCopyPattern_engagementScore_idx" ON "ViralCopyPattern"("engagementScore");

-- CreateIndex
CREATE INDEX "TrendSignal_phase_platform_idx" ON "TrendSignal"("phase", "platform");

-- CreateIndex
CREATE INDEX "TrendSignal_velocityScore_idx" ON "TrendSignal"("velocityScore"); 

-- CreateIndex
CREATE UNIQUE INDEX "TrendSignal_platform_keyword_key" ON "TrendSignal"("platform", "keyword");

-- CreateIndex
CREATE INDEX "UserEditLog_userId_createdAt_idx" ON "UserEditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserEditLog_brandId_idx" ON "UserEditLog"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "SummarizedPreference_brandId_key" ON "SummarizedPreference"("brandId");

-- CreateIndex
CREATE INDEX "QualityScoreLog_userId_createdAt_idx" ON "QualityScoreLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "QualityScoreLog_score_idx" ON "QualityScoreLog"("score");

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramAccount" ADD CONSTRAINT "InstagramAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramAccount" ADD CONSTRAINT "InstagramAccount_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarouselSlide" ADD CONSTRAINT "CarouselSlide_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGenerationLog" ADD CONSTRAINT "AiGenerationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; 

-- AddForeignKey
ALTER TABLE "AdminNote" ADD CONSTRAINT "AdminNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;        

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;      

-- AddForeignKey
ALTER TABLE "UserEditLog" ADD CONSTRAINT "UserEditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEditLog" ADD CONSTRAINT "UserEditLog_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;       

-- AddForeignKey
ALTER TABLE "SummarizedPreference" ADD CONSTRAINT "SummarizedPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SummarizedPreference" ADD CONSTRAINT "SummarizedPreference_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityScoreLog" ADD CONSTRAINT "QualityScoreLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityScoreLog" ADD CONSTRAINT "QualityScoreLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
