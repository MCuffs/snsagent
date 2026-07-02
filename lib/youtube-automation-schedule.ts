export const YOUTUBE_AUTOMATION_UNLOCK_HOURS = 12
export const YOUTUBE_AUTOMATION_UNLOCK_MS = YOUTUBE_AUTOMATION_UNLOCK_HOURS * 60 * 60 * 1000

export function isYouTubeDayUnlockDue(completedAt: Date, now = new Date()) {
  return completedAt.getTime() + YOUTUBE_AUTOMATION_UNLOCK_MS <= now.getTime()
}
