export interface YouTubeAutomationDayState {
  dayNumber: number
  status: string
  mp4Url?: string | null
  requiresUpgrade?: boolean
}

export type YouTubeAutomationDayLockReason = 'upgrade' | 'schedule' | null

export function getYouTubeAutomationDayLockReason(
  day: YouTubeAutomationDayState,
  timeLocked = false,
): YouTubeAutomationDayLockReason {
  if (day.requiresUpgrade) return 'upgrade'
  if (timeLocked || day.status === 'locked') return 'schedule'
  return null
}

export function isYouTubeAutomationDayOpen(
  day: YouTubeAutomationDayState,
  currentOpenDay: number,
) {
  return day.dayNumber <= currentOpenDay && day.status !== 'locked'
}

export function canMarkYouTubeAutomationDayUploaded(
  day: YouTubeAutomationDayState,
  currentOpenDay: number,
) {
  return isYouTubeAutomationDayOpen(day, currentOpenDay)
    && Boolean(day.mp4Url)
    && (day.status === 'completed' || day.status === 'uploaded')
}
