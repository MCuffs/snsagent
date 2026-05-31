import { truncateAtSentenceBoundary } from './truncate'

export interface RenderableCopyConstraints {
  maxHeadlineChars: number
  maxBodyChars: number
  maxBodyLines: number
  lineLength: number
}

export interface RenderableCopyResult {
  headline: string
  body: string
  issues: string[]
}

export function repairRenderableCopy(params: {
  headline: string
  body: string
  constraints: RenderableCopyConstraints
}): RenderableCopyResult {
  const issues: string[] = []
  let headline = normalizeCopy(params.headline)
  let body = normalizeCopy(params.body)

  if (headline.length > params.constraints.maxHeadlineChars) {
    headline = truncateAtSentenceBoundary(headline, params.constraints.maxHeadlineChars)
    issues.push('headline shortened to fit render constraints')
  }

  if (body.length > params.constraints.maxBodyChars) {
    body = summarizeBody(body, params.constraints.maxBodyChars)
    issues.push('body summarized to fit character constraints')
  }

  let lines = wrapForRender(body, params.constraints.lineLength)
  if (lines.length > params.constraints.maxBodyLines) {
    body = summarizeBody(body, Math.max(40, params.constraints.maxBodyLines * params.constraints.lineLength - 8))
    lines = wrapForRender(body, params.constraints.lineLength)
    issues.push('body summarized to fit line constraints')
  }

  if (lines.length > params.constraints.maxBodyLines) {
    body = lines.slice(0, params.constraints.maxBodyLines).join(' ')
    body = truncateAtSentenceBoundary(body, body.length)
    issues.push('body could not fit naturally and was reduced to visible lines')
  }

  return { headline, body, issues }
}

export function validateRenderableCopy(params: {
  headline: string
  body: string
  constraints: RenderableCopyConstraints
}) {
  const issues: string[] = []
  if (params.headline.length > params.constraints.maxHeadlineChars) {
    issues.push(`headline exceeds ${params.constraints.maxHeadlineChars} chars`)
  }
  if (params.body.length > params.constraints.maxBodyChars) {
    issues.push(`body exceeds ${params.constraints.maxBodyChars} chars`)
  }
  const lines = wrapForRender(params.body, params.constraints.lineLength)
  if (lines.length > params.constraints.maxBodyLines) {
    issues.push(`body wraps to ${lines.length} lines; max is ${params.constraints.maxBodyLines}`)
  }
  return { passed: issues.length === 0, issues, lines }
}

export function wrapForRender(value: string, maxLength: number) {
  const compact = normalizeCopy(value)
  if (!compact) return []

  const lines: string[] = []
  let line = ''
  for (const token of compact.split(' ')) {
    const next = line ? `${line} ${token}` : token
    if (line && visualLength(next) > maxLength) {
      lines.push(line)
      line = token
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

function summarizeBody(value: string, maxChars: number) {
  const sentences = normalizeCopy(value).split(/(?<=[.!?。！？]|다\.|요\.|죠\.|니다\.)\s+/).filter(Boolean)
  let output = ''
  for (const sentence of sentences) {
    const next = output ? `${output} ${sentence}` : sentence
    if (next.length > maxChars) break
    output = next
  }
  if (output.length >= Math.min(36, maxChars)) return output

  const clauses = normalizeCopy(value).split(/\s*(?:,|·|;|그리고|또한|하지만|그래서)\s*/).filter(Boolean)
  output = ''
  for (const clause of clauses) {
    const next = output ? `${output}. ${clause}` : clause
    if (next.length > maxChars) break
    output = next
  }
  if (output.length >= Math.min(24, maxChars)) return endClean(output)

  return endClean(truncateAtSentenceBoundary(value, maxChars))
}

function endClean(value: string) {
  return value.replace(/[,\s]+$/, '').trim()
}

function normalizeCopy(value: string) {
  return String(value || '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function visualLength(value: string) {
  return Array.from(value).reduce((sum, char) => sum + (/[ -~]/.test(char) ? 0.55 : 1), 0)
}
