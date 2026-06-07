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
  if (completeSentences.length === 0) return hardFitCompleteCopy(normalized, constraints)

  let output = ''
  for (const sentence of completeSentences) {
    // If this sentence alone exceeds the char limit, truncate it first
    const fittedSentence = sentence.length > constraints.maxBodyChars
      ? truncateAtSentenceBoundary(sentence, constraints.maxBodyChars)
      : sentence
    const next = output ? `${output} ${fittedSentence}` : fittedSentence
    if (
      next.length <= constraints.maxBodyChars &&
      wrapForRender(next, constraints.lineLength).length <= constraints.maxBodyLines
    ) {
      output = next
    } else if (!output && fittedSentence.length <= constraints.maxBodyChars) {
      // First sentence fits on its own even if adding more would exceed — use it
      output = fittedSentence
    }
  }

  return output || hardFitCompleteCopy(normalized, constraints)
}

function hardFitCompleteCopy(value: string, constraints: RenderableCopyConstraints) {
  let fitted = truncateAtSentenceBoundary(value, constraints.maxBodyChars)
  while (
    fitted.length > 8 &&
    wrapForRender(fitted, constraints.lineLength).length > constraints.maxBodyLines
  ) {
    fitted = truncateAtSentenceBoundary(fitted, Math.max(8, fitted.length - 6))
  }
  if (isCompleteBodyCopy(fitted)) return fitted
  return completeFallbackBody(fitted)
}

export function isCompleteBodyCopy(value: string) {
  const normalized = normalizeCopy(value)
  if (!normalized) return false
  if (hasIncompleteMeaningEnding(normalized)) return false
  if (hasDanglingDemonstrativePronoun(normalized)) return false
  if (/[.!?。！？]$/.test(normalized)) return true
  return /(습니다|합니다|됩니다|입니다|주세요|보세요|하세요|좋습니다|중요합니다|필요합니다|가능합니다|분명합니다|이어집니다|낮아집니다|높아집니다|있습니다|없습니다|같습니다|해집니다|줍니다|듭니다|납니다)$/.test(normalized)
}

function completeFallbackBody(value: string) {
  const normalized = normalizeCopy(value)
  const withoutDanglingEnding = normalized
    .replace(/[.!?。！？,，、;:]\s*$/, '')
    .replace(/\s*(은|는|이|가|을|를|에|에서|으로|로|와|과|도|만|부터|까지|보다|처럼|이나|거나|그리고|하지만|그래서|때문에|도록|라면|하면)$/u, '')
    .trim()
  if (isCompleteBodyCopy(withoutDanglingEnding)) return withoutDanglingEnding
  if (withoutDanglingEnding.length >= 18 && !hasIncompleteMeaningEnding(withoutDanglingEnding)) return `${withoutDanglingEnding}.`
  return withoutDanglingEnding || normalized
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

function hasIncompleteMeaningEnding(value: string) {
  const withoutPunctuation = value.replace(/[.!?。！？]+$/u, '').trim()
  return /(?:함께 있는|함께 봐야|대신 분명한|살피는|많이 먹는|한 번에|커지는지|이어지는지|은|는|이|가|을|를|에|에서|으로|로|와|과|도|만|부터|까지|보다|처럼|이나|거나|더|다시|먼저|쓸|봐야|한 줄)$/u.test(withoutPunctuation)
}

function hasDanglingDemonstrativePronoun(value: string) {
  // "내 결제창엔 이 더 빨리" 같이 지시대명사(이/그/저)가 명사 없이 단독으로 노출되는 패턴
  return /[가-힣]\s+(이|그|저)\s+(더|빨리|먼저|늦게|빠르게|크게|작게|많이|적게|자주|항상|바로|꼭|또|다시|확실히)\s/.test(value)
}

function visualLength(value: string) {
  return Array.from(value).reduce((sum, char) => sum + (/[ -~]/.test(char) ? 0.55 : 1), 0)
}
