type YouTubeAutomationLogLevel = 'info' | 'warn' | 'error'

type YouTubeAutomationLogContext = {
  requestId?: string | null
  route?: string
  userId?: string
  dayId?: string
  projectId?: string
  dayNumber?: number
  title?: string
}

export function logYouTubeAutomation(
  level: YouTubeAutomationLogLevel,
  event: string,
  context: YouTubeAutomationLogContext = {},
  details: Record<string, unknown> = {},
) {
  const payload = {
    level,
    service: 'youtube-automation',
    event,
    timestamp: new Date().toISOString(),
    ...compact(context),
    ...compact(details),
  }
  const line = JSON.stringify(payload)
  if (level === 'error') {
    console.error(line)
    return
  }
  if (level === 'warn') {
    console.warn(line)
    return
  }
  console.log(line)
}

export function summarizeYouTubeAutomationError(error: unknown) {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: sanitizeLogValue(error.message),
      errorStack: sanitizeLogValue(error.stack)?.slice(0, 1800),
    }
  }
  return { errorMessage: sanitizeLogValue(String(error)) }
}

function compact(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

function sanitizeLogValue(value: string | undefined) {
  if (!value) return value
  return value
    .replace(/https?:\/\/\S+/g, '[external-url]')
    .replace(/\s+/g, ' ')
    .slice(0, 2400)
}
