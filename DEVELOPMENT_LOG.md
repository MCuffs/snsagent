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
