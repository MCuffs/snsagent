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
