export const YOUTUBE_PRODUCTION_ACTIVE_STATUSES = ['planning', 'rendering'] as const

export const YOUTUBE_PRODUCTION_STALE_MS = positiveInteger(
  process.env.YOUTUBE_PRODUCTION_STALE_MS,
  12 * 60 * 1000,
  60_000,
  30 * 60 * 1000,
)

export const YOUTUBE_CANCEL_SETTLE_MS = positiveInteger(
  process.env.YOUTUBE_CANCEL_SETTLE_MS,
  120_000,
  10_000,
  10 * 60 * 1000,
)

// How many renders may run at the same time across the whole service.
// Requests start immediately via after(); the recovery cron respects this cap too.
export const YOUTUBE_RENDER_MAX_CONCURRENT = positiveInteger(
  process.env.YOUTUBE_RENDER_MAX_CONCURRENT,
  3,
  1,
  8,
)

export function isYouTubeProductionActiveStatus(status: string | null | undefined) {
  return YOUTUBE_PRODUCTION_ACTIVE_STATUSES.includes(status as typeof YOUTUBE_PRODUCTION_ACTIVE_STATUSES[number])
}

function positiveInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}
