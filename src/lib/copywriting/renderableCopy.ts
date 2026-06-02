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

  if (!isCompleteBodyCopy(body)) {
    body = fitCompleteSentences(body, params.constraints)
    if (!isCompleteBodyCopy(body)) {
      body = completeFallbackBody(body)
      issues.push('body completed with fallback sentence ending')
    }
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
  if (!isCompleteBodyCopy(params.body)) {
    issues.push('body does not end as a complete sentence')
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

export function isCompleteBodyCopy(value: string) {
  const normalized = normalizeCopy(value)
  if (!normalized) return false
  if (/[.!?。！？]$/.test(normalized)) return true
  return /(습니다|합니다|됩니다|입니다|주세요|보세요|하세요|좋습니다|중요합니다|필요합니다|가능합니다|분명합니다|이어집니다|낮아집니다|높아집니다|있습니다|없습니다|같습니다|해집니다|줍니다|듭니다|납니다)$/.test(normalized)
}

function completeFallbackBody(value: string) {
  const normalized = normalizeCopy(value)
  const withoutDanglingEnding = normalized
    .replace(/[,，、;:]\s*$/, '')
    .replace(/\s+(은|는|이|가|을|를|에|에서|으로|로|와|과|도|만|부터|까지|보다|처럼|그리고|하지만|그래서|때문에|도록|라면|하면)$/u, '')
    .trim()
  if (isCompleteBodyCopy(withoutDanglingEnding)) return withoutDanglingEnding
  if (/불포화지방산이$/u.test(withoutDanglingEnding)) {
    return withoutDanglingEnding.replace(/불포화지방산이$/u, '불포화지방산이 포함되어 있어 식사 사이 간식 선택의 기준이 됩니다.')
  }
  if (/어떤 식사와 함께$/u.test(withoutDanglingEnding)) {
    return `${withoutDanglingEnding} 먹을지 정해두면 루틴으로 이어가기 쉽습니다.`
  }
  if (/(은|는|이|가|을|를|으로|도록|라면|하면|필요|중요|좋은|많은|위한)$/.test(withoutDanglingEnding)) {
    return '핵심 정보와 실천 기준을 함께 정리하면 독자가 바로 저장해둘 이유가 생깁니다.'
  }
  if (withoutDanglingEnding.length >= 18) return `${withoutDanglingEnding}.`
  return '핵심 정보와 실천 기준을 함께 정리하면 독자가 바로 저장해둘 이유가 생깁니다.'
}

function splitCompleteSentences(value: string) {
  const sentences: string[] = []
  const pattern = /.+?(?:[.!?。！？]+|(?:습니다|합니다|됩니다|입니다|주세요|보세요|하세요|좋습니다|중요합니다|필요합니다|가능합니다|분명합니다|이어집니다|낮아집니다|높아집니다|있습니다|없습니다|같습니다|해집니다|줍니다|듭니다|납니다)(?=\s|$))/g
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
