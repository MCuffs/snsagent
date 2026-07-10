export interface YouTubeAutomationDayState {
  dayNumber: number
  status: string
  mp4Url?: string | null
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
