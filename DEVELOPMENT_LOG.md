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
