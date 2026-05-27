# Development Log

This file records meaningful development work, fixes, verification commands, and operational notes.

## 2026-05-21 17:06 KST

### Summary
- Recovered the Next.js app after initial build failures.
- Pushed the initial working service to `MCuffs/snsagent`.
- Hardened high-impact security paths that were safe to improve immediately.

### Changes
- Fixed invalid UTF-8 and broken JSX in `app/(dashboard)/brand/page.tsx`.
- Added `turbopack.root` in `next.config.ts` per local Next.js 16 documentation to avoid workspace-root inference issues.
- Removed lint-blocking `any`, unused imports, and legacy `require()` usage.
- Added Server Action ownership checks for brand, campaign, slide, post, Instagram account, scheduling, and regeneration flows.
- Added `dbService.getSlide()` and `dbService.getPost()` helpers for authorization checks.
- Replaced Instagram token base64 obfuscation with AES-256-GCM encryption while keeping legacy base64 reads compatible.
- Added `INSTAGRAM_TOKEN_ENCRYPTION_KEY` to `.env.example`.

### Verification
- `npm run lint`
- `npm run build`
- Confirmed production server returned HTTP `200` at `http://127.0.0.1:3000/`.

### GitHub
- Initial push: `eb37372 Initial SNS AI agent service`
- Security hardening push: `3ffb201 Harden ownership checks and token encryption`

### Notes
- No local server is currently running on port `3000`.
- `prisma/db.json` contains local demo runtime state and should not be committed unless intentionally updating seed/demo data.

## 2026-05-21 17:10 KST

### Summary
- Kept the production server running for local review.
- Continued immediate hardening work around input validation and environment handling.

### Changes
- Added `lib/env.ts` for typed environment helpers and production token-secret validation.
- Added `SUBSCRIPTION_PLANS` and `isSubscriptionPlan()` to validate plan changes before updating user state.
- Reused environment helpers for Instagram mock mode, account fallback, and OpenAI key placeholder checks.
- Updated Instagram token encryption to reject missing placeholder secrets in production runtime.

### Verification
- `npm run lint`
- `npm run build`
- Restarted `next start`.
- Confirmed HTTP `200` at `http://127.0.0.1:3000/`.

### Notes
- Server is currently running at `http://localhost:3000`.
- Network URL: `http://10.31.100.27:3000`.

## 2026-05-21 17:25 KST

### Summary
- Added a modular carousel generation backend pipeline.
- Replaced the new campaign creation client flow with `POST /api/campaigns/generate`.

### Changes
- Added `src/lib/carousel/*` engines for strategy, hooks, structure, copy, design prompts, caption, rendering, quality checks, and orchestration.
- Added `src/lib/ai/imageProvider.ts` and mock/OpenAI/ByteDance provider implementations.
- Added `src/lib/usageLimit.ts` for monthly plan-based campaign usage checks.
- Added `src/app/api/campaigns/generate/route.ts` and a root `app/api/campaigns/generate/route.ts` bridge so the route is active with the existing root `app/` project layout.
- Updated `CreateCampaignForm` to call the API route instead of the previous single-step Server Action.
- Added generated asset storage under `public/generated/carousel`.
- Updated `.env.example` and README pipeline documentation.

### Verification
- `npm run lint`
- `npm run build`

### Notes
- The renderer currently writes SVG assets through an isolated renderer module. It is intentionally separated so a Sharp/Puppeteer PNG renderer can replace it without changing strategy/copy/image generation stages.

## 2026-05-21 17:42 KST

### Summary
- Simplified the Instagram connection flow for local demo and early product testing.

### Changes
- Added `quickConnectInstagramAction()` for one-click mock Instagram account connection.
- Added `getInstagramAccessToken()` environment helper.
- Updated `/instagram` to show a prominent demo quick-connect panel when `INSTAGRAM_MOCK_MODE=true`.
- Kept the real Meta API form available for production connection while making it secondary to the demo path.
- Made manual save fallback to mock env values in mock mode when fields are empty.
- Added safe token decrypt handling on the settings page so key rotation or legacy data does not crash the page.
- Updated README with quick-connect guidance.

### Verification
- `npm run lint`
- `npm run build`

## 2026-05-21 18:27 KST

### Summary
- Added the first real Meta OAuth connection path for faster production Instagram setup.

### Changes
- Added `app/api/auth/meta/start/route.ts` to start Meta OAuth with nonce-backed state validation.
- Added `app/api/auth/meta/callback/route.ts` to exchange authorization codes, upgrade long-lived tokens, discover Instagram Business accounts, and save the first eligible account.
- Added `app/api/instagram/accounts/route.ts` for account discovery support.
- Added `lib/meta/oauth.ts`, `lib/meta/pages.ts`, and `lib/meta/types.ts`.
- Extended `InstagramAccount` schema and DB service with Facebook Page ID, encrypted page token, token expiry, username, profile image, and connection method fields.
- Updated `/instagram` with an “Instagram으로 실제 연결” path while keeping demo quick-connect and manual fallback.
- Updated `.env.example` and README with Meta OAuth settings and callback setup.
- Regenerated Prisma Client after schema changes.

### Verification
- `npx prisma generate`
- `npm run lint`
- `npm run build`

## 2026-05-22 KST

### Summary
- Introduced URL-driven brand profiling and expanded the media-card rendering system.
- Added the first AI-assisted simplified campaign generation workflow and scheduler corrections.

### Changes
- Added website/store URL scraping and AI brand profile generation, including Naver Smartstore fallback handling.
- Connected generated brand profiles to campaign creation.
- Added and refined the media carousel layout stack: layout definitions, typography, overlay rendering, reference pattern analysis, and quality checks.
- Added the 10 editorial layout configurations used by the media pipeline.
- Fixed relative generated-image URL conversion for Instagram scheduler and cron publishing.
- Continued landing and dashboard visual iteration.

### Git History
- `fda0b25` URL-based AI brand profiler
- `4cc28cf` Naver Smartstore fallback handling
- `1aafd59` simplified AI-assisted generator
- `0736457` Korean editorial rendering engine
- `64faa8b` enhanced carousel engines and campaign data

## 2026-05-23 to 2026-05-24 KST

### Summary
- Stabilized brand save and rendering behavior.
- Added multi-agent quality reporting and expanded error logging around generation.

### Changes
- Wired `OPENAI_BASE_URL` through AI clients and addressed missing-brand paths.
- Fixed brand upsert/save feedback and renderer issues involving Korean typography, line breaks, and clipped titles.
- Added carousel agents and persisted `agentReport` data on generated campaigns.
- Expanded action/API error logging and protected ownership-sensitive paths.

### Git History
- `8f74769` brand-not-found fixes and AI base URL wiring
- `b03712b` renderer whitespace and clipping fixes
- `dc8122d` multi-agent system and error logging hooks
- `df9c531` brand limit error handling

## 2026-05-25 KST

### Summary
- Replaced the previous dashboard experience with the Shuffla CMS flow.
- Added conversational Agent UX, expanded brand analysis providers, and implemented PayPal subscription plumbing.

### Changes
- Redesigned marketing pages and added `/pricing`, `/blog`, and the current Shuffla visual identity.
- Added Brand DNA persistence, brand URL/product context, reference image upload API, and image/storage improvements.
- Implemented PayPal subscription UI, activate/cancel/webhook API routes, schema support, and setup/migration scripts after a short-lived Stripe implementation was replaced.
- Changed plans to `FREE`, `LITE`, `PRO`, `UNLIMITED` with card-news generation count limits.
- Added the CMS routes `/concept`, `/generate`, `/works`, `/billing`, and `/campaign/[id]`; removed the earlier `(dashboard)` screen group.
- Added Perplexity, Groq, Gemini, and Naver integrations to brand analysis.
- Added `/api/agents/brand` and `/api/agents/generate` for conversational brand refinement and generation setup.
- Added result-screen editing improvements including font/color controls, faster text rerendering, style regeneration, and Agent activity display.

### Git History
- `ca0b87a` PayPal integration replacing Stripe
- `a8f0d32`, `bf2a1d6` CMS route introduction and dashboard removal
- `e125736` current plan model
- `610abc9` expanded brand analysis providers
- `0e62ba9` conversational Agent UX

### Known Follow-up Identified
- The CMS migration removed the Instagram settings page while Meta OAuth callbacks still redirect to `/instagram`.
- The result-screen background replacement and new-campaign navigation need route/API contract fixes.
- Authentication session integrity and PayPal plan authorization remain production blockers.

## 2026-05-26 KST

### Summary
- Recorded the current architecture, implementation status, and improvement priorities.

### Changes
- Added `CURRENT_STATUS_AND_IMPROVEMENTS.md` and `SYSTEM_ARCHITECTURE.md`.
- Recorded the active media pipeline changes: objective forwarding and LLM-generated slide copy in `mediaCarouselPipeline`.
- Reconciled `README.md` and `LAYERS.md` with the active CMS routes, PayPal implementation, current plan model, and unconnected Instagram UI.
- Expanded the status document to distinguish connected implementation from production-readiness work.
- Expanded `.env.example` with current analysis providers, PayPal, Prisma direct URL, OpenAI base URL, and cron configuration keys.

### Verification
- `npm ci` completed; npm reported 2 moderate vulnerabilities.
- `npm run build` passed with Next.js `16.2.6`; build output listed the CMS, Agent, PayPal, and publishing API routes.
- `npm run lint` failed with four existing errors: three in `app/(cms)/generate/GenerateForm.tsx` and one `prefer-const` issue in `app/actions.ts`; three unused-symbol warnings were also reported.

### Git History
- `c19c7d2` current system status and architecture

## 2026-05-26 KST - Priority Remediation

### Scope
- Addressed the highest-risk authentication, subscription authorization, and connected CMS flow issues.
- Kept the Instagram account connection and publishing UI outside this implementation scope for later development.

### Changes
- Replaced the trusted email cookie with an HMAC-signed session token using `SESSION_SECRET`, removed legacy cookies on sign-in/sign-out, and blocked development email login in production.
- Changed PayPal activation to derive the internal plan only from the verified subscription `plan_id`, blocked direct paid-plan assignment, and aligned the cancellation UI with the current immediate `FREE` transition policy.
- Connected up to four product reference image uploads from `/generate`, corrected the result-screen background replacement upload contract, and routed new generation requests to `/generate`.
- Normalized legacy saved plan values in billing/result pages and completed mock PayPal subscription persistence for local verification.
- Hardened external URL collection against private-address/redirect/oversized-response SSRF cases and limited image-provider reference fetches to trusted uploaded URLs.
- Added fallback guards for missing AI array fields in the media and commerce carousel generation paths.
- Updated the status, architecture, layering, README, and environment setup documents to match the implemented behavior and deferred Instagram scope.

### Verification
- `npm run lint` passed after remediation.
- `npm run build` passed with Next.js `16.2.6`.
- `npm ci` continues to report 2 moderate audit findings for follow-up dependency review.

## 2026-05-26 KST - Frontend and Pricing Alignment

### Changes
- Replaced marketing `무료로 시작하기` calls to action with `Google Login` and changed landing claims to the implemented generate, edit, and download workflow.
- Removed Instagram connection and automatic publishing claims from public marketing, pricing, blog, and CMS-visible status text; backend integration code remains deferred for a later product scope.
- Replaced the exposed pricing tiers with Single (월 3,000원/1회), Creator (월 19,000원/10회), and Studio (월 45,000원/30회).
- Changed internal `FREE` to an entitlement-free state used before purchase or after cancellation, and synchronized CMS limits and PayPal KRW setup definitions with the displayed prices.
- Removed unimplemented watermark messaging from the result and billing screens and prevented users with an active subscription from selecting another PayPal subscription before cancellation.

### Operational Note
- Existing PayPal plan IDs do not acquire new prices automatically. Deployment must run `scripts/paypal-setup.mjs` for the KRW plans and replace `NEXT_PUBLIC_PAYPAL_PLAN_*` values before selling the new tiers.

### Verification
- `git diff --check` passed.
- `npm run lint` passed.
- `npm run build` passed with Next.js `16.2.6`; static generation completed for 20 pages.

## 2026-05-26 KST - Creator Usage Expansion and Unit Economics Controls

### Changes
- Changed Creator from 월 19,000원/10회 to 월 19,000원/20회 across plan limits, pricing UI, billing UI, documentation, and PayPal setup definitions.
- Fixed the billable CMS OpenAI image path to `gpt-image-1` at `1024x1024` low quality for a stable pricing baseline.
- Added campaign image accounting fields for the initial model/image count and AI background regeneration usage.
- Limited included AI background regeneration to one full-campaign equivalent: a campaign with N slides can consume at most N AI background regeneration images, through either individual or full-style regeneration.
- Added `UNIT_ECONOMICS.md`, `scripts/migrate-image-usage.mjs`, and `scripts/paypal-update-creator-plan.mjs`.

### Operational Note
- The Creator charge remains KRW 19,000, so an existing PayPal plan requires a description update rather than a price change. This workspace has no PayPal credentials configured, so the remote PayPal PATCH must run in the deployment credential environment.
- PayPal's Korean merchant fee table lists international commercial payments as 4.40% plus a fixed fee but does not list a KRW fixed-fee value. KRW plan acceptance and final unit economics require sandbox or live transaction confirmation.

### Frontend Follow-up
- Routed public `Google Login` calls to action directly to `/api/auth/google/start` while retaining `/login` for OAuth errors and local development entry.
- Aligned all public pricing cards with the included per-campaign AI background regeneration allowance.

## 2026-05-26 KST - Domestic Toss Payments and International PayPal Billing

### Changes
- Removed the Naver Pay payment path and added Toss Payments automatic billing for domestic card subscriptions while retaining PayPal Subscription for international customers.
- Added the SDK billing-auth entry, server-side billing-key issuance and initial charge callback, immediate cancellation, and protected monthly renewal route.
- Stored a randomized Toss `customerKey`, billing key, latest payment/order identifiers, and billing dates on the user; payment amounts remain server-defined by the selected paid plan.
- Retained PayPal subscription activation, cancellation and webhook synchronization for international buyers, requiring signature validation even in sandbox.
- Recalculated the domestic `UNIT_ECONOMICS.md` baseline using Toss Payments' published credit/debit card general rate of 3.4% plus VAT and noted separate overseas PayPal validation.

### Operational Note
- Toss Payments automatic billing requires a separate billing MID contract and API individual integration keys.
- Toss Payments does not schedule monthly charges. Deployment must apply `scripts/migrate-tosspayments.mjs` before deploying payment code and invoke `/api/cron/billing` with `CRON_SECRET` on a recurring schedule.
- The migration retains `naverpayRecurrentId` and `naverpaySubscriptionStatus` compatibility columns because an earlier deployed Prisma Client still selects them during login until the payment-provider release rolls out.
- PayPal international sales require configured monthly plan IDs and a verified webhook; exchange and cross-border fees must be confirmed with test and live transactions.

## 2026-05-26 KST - AI-Assisted Editorial Carousel Studio

### Changes
- Replaced the static result preview/form editor with a 1080x1350 direct manipulation canvas backed by a versioned `editorDocument`.
- Added background, overlay, title, subtitle, sticker, CTA and watermark layers with ordering, visibility, positioning, opacity, scale, blur and motion metadata controls.
- Added inline text editing, drag movement with safe-zone/center snapping, typography and cinematic overlay presets, undo/redo, and debounced autosave using isolated Zustand editor state.
- Added AI-assisted copy refinement and current-background variations that preserve the user-controlled document rather than regenerating full slides.
- Stored the last confirmed typography and overlay selection on `Brand.editorPreferences` and reuse it as a new slide editing default.
- Preserved original background image URLs separately from composed results, preventing repeated text compositing when editing an existing card.
- Added deterministic editorial document rendering and PNG/JPG/PNG 2x/current-campaign ZIP export paths.

### Operational Note
- Deployments must run `node scripts/migrate-slide-customization.mjs` before serving this build so Prisma can select the new `CarouselSlide` document and customization fields.
- Multi-session learned style recommendations beyond the last confirmed brand preference, motion video output and real-time collaboration remain follow-up scopes; the layer document includes metadata needed to extend toward those workflows.

## 2026-05-27 KST - Repository Migration and Development Deployment

### Summary
- Migrated the current code history to the `Shuffla-AI/Shuffla_SaaS` repository.
- Configured a CI deployment route for the `dev` branch while the Vercel project remains on the Hobby plan.

### Changes
- Preserved the previous repository history and the new organization repository's initial commit in migration commit `5b35a2d`.
- Pushed the same migration baseline to `main` and `dev` in `Shuffla-AI/Shuffla_SaaS`.
- Confirmed the official Vercel GitHub App is installed for the `Shuffla-AI` organization.
- Identified that Vercel Hobby cannot directly connect an organization-owned private GitHub repository.
- Added `.github/workflows/vercel-dev-production.yml` with `actions/checkout@v6` so a push to `dev` builds inside GitHub Actions and uploads prebuilt output to the Vercel production deployment through the CLI.
- Configured encrypted GitHub Actions repository secrets for the Vercel token, team ID, and project ID.
- Documented required Actions secrets and the Hobby non-commercial-use limitation in `README.md`.

### Operational Note
- The CI route intentionally treats `dev` as the current deployment branch. Before commercial operation, deployment must move to a commercially permitted plan or host and the release branch policy should return to `main`.

### Verification
- `git diff --check` passed.
- `npx --yes prettier --check .github/workflows/vercel-dev-production.yml` passed.
- `npm run build` passed with Next.js `16.2.6`.
- `npm run lint` still reports two pre-existing errors in `app/(cms)/TabContext.tsx` and `src/lib/ai/providers/openAIImageProvider.ts`; these files were not changed by the deployment configuration.

## 2026-05-27 KST - Production Google Login Recovery

### Issue
- Production Google OAuth failed after the GitHub Actions prebuilt deployment because Prisma Client was generated on the CI runner for `debian-openssl-3.0.x`, while the Vercel function runtime requires `rhel-openssl-3.0.x`.
- The production schema also required verification against the currently deployed billing and editorial fields before authentication could be considered restored.

### Changes
- Added `rhel-openssl-3.0.x` to Prisma Client `binaryTargets` so Vercel runtime functions can load the query engine from GitHub Actions prebuilt deployments.
- Used a temporary bearer-protected production recovery route to execute idempotent schema additions from inside the Vercel runtime, then removed the route and its temporary secret after recovery.

### Verification
- `npm run build` passed with the Vercel Prisma engine included.
- The protected runtime recovery request returned HTTP `200` after applying schema changes and verifying current Prisma reads for `User`, `Brand`, `Campaign`, and `CarouselSlide`.

## 2026-05-27 KST - Vercel Pro Git Integration Normalization

### Summary
- Upgraded the deployment path from the Vercel Hobby workaround to the supported Vercel Pro Git Integration flow.
- Restored `main` as the production release branch; `dev` is used for preview and validation.

### Changes
- Connected the Vercel project `snsagent` directly to `Shuffla-AI/Shuffla_SaaS`.
- Removed `.github/workflows/vercel-dev-production.yml`; Production builds no longer depend on GitHub Actions prebuilt uploads or `VERCEL_*` deployment secrets.
- Retained the Prisma Vercel runtime binary target and `.vercelignore` asset exclusions because they are runtime and deployment-safety settings, not Hobby routing workarounds.

### Operational Policy
- Pushes and merges to `main` trigger Production through Vercel Git Integration.
- Pushes and pull requests from `dev` and feature branches create Preview deployments.
- Manual CLI Production deployments are reserved for recovery or diagnosis.

### Verification
- Confirmed the Vercel project Git connection to `Shuffla-AI/Shuffla_SaaS`.
- `git diff --check` passed.
- `npm run build` passed with Next.js `16.2.6`.
