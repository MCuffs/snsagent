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
    body = fitCompleteSentences(body, params.constraints)
    issues.push('body summarized to fit character constraints')
  }

  let lines = wrapForRender(body, params.constraints.lineLength)
  if (lines.length > params.constraints.maxBodyLines) {
    body = fitCompleteSentences(body, params.constraints)
    lines = wrapForRender(body, params.constraints.lineLength)
    issues.push('body summarized to fit line constraints')
  }

  if (lines.length > params.constraints.maxBodyLines) {
    issues.push('body exceeds visible lines but was preserved to avoid cutting a sentence')
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

function fitCompleteSentences(value: string, constraints: RenderableCopyConstraints) {
  const normalized = normalizeCopy(value)
  const completeSentences = splitCompleteSentences(normalized)
  if (completeSentences.length === 0) return normalized

  let output = ''
  for (const sentence of completeSentences) {
    const next = output ? `${output} ${sentence}` : sentence
    if (
      next.length <= constraints.maxBodyChars &&
      wrapForRender(next, constraints.lineLength).length <= constraints.maxBodyLines
    ) {
      output = next
    }
  }

  return output || normalized
}

function splitCompleteSentences(value: string) {
  const sentences: string[] = []
  const pattern = /.+?(?:[.!?。！？]+|(?:습니다|합니다|됩니다|입니다|합니다|주세요|보세요|해보세요|하세요|됩니다|좋습니다|중요합니다|갈립니다|이어집니다|높입니다|돕습니다|있습니다|없습니다|같습니다|됩니다)(?=\s|$))/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(value)) !== null) {
    const sentence = match[0].trim()
    if (sentence) sentences.push(sentence)
  }
  return sentences
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
