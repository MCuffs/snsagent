import { repairRenderableCopy, validateRenderableCopy, wrapForRender } from '../copywriting/renderableCopy'

export interface CardHarnessContract {
  role: string
  maxHeadlineChars: number
  maxBodyChars: number
  maxBodyLines: number
  lineLength: number
  maxTotalChars: number
  requiresAction: boolean
}

export const HARNESSED_COPY_META_TOKENS = [
  'daily use scene',
  'mirror audience life',
  'one defining object',
  'imagePurpose',
  'guiding question',
  'STORY ONTOLOGY',
  'visualDirection',
  'LAYOUT PRIORITY',
  'recognizable daily situation',
]

export function getCardHarnessContract(role: string | undefined): CardHarnessContract {
  const normalizedRole = role || 'detail'
  const isClosing = ['summary', 'save-cta', 'cta'].includes(normalizedRole)
  return {
    role: normalizedRole,
    maxHeadlineChars: isClosing ? 22 : 20,
    maxBodyChars: isClosing ? 58 : 64,
    maxBodyLines: 2,
    lineLength: isClosing ? 22 : 24,
    maxTotalChars: isClosing ? 78 : 84,
    requiresAction: ['save-cta', 'cta'].includes(normalizedRole),
  }
}

export function repairCopyToHarness(params: {
  topic: string
  role: string
  headline: string
  body: string
}): { headline: string; body: string; issues: string[] } {
  const contract = getCardHarnessContract(params.role)
  const issues: string[] = []
  let body = normalizeCopy(params.body)
  const headline = normalizeCopy(params.headline)

  if (containsMetaToken(`${headline} ${body}`)) {
    body = buildHarnessFallbackBody(params.topic, params.role)
    issues.push('body replaced because it leaked planning metadata')
  }

  if (contract.requiresAction && !hasActionCue(body)) {
    body = buildActionBody(params.topic)
    issues.push('body replaced because CTA action was missing')
  }

  let repaired = repairRenderableCopy({
    headline,
    body,
    constraints: {
      maxHeadlineChars: contract.maxHeadlineChars,
      maxBodyChars: contract.maxBodyChars,
      maxBodyLines: contract.maxBodyLines,
      lineLength: contract.lineLength,
    },
  })
  issues.push(...repaired.issues)

  const validation = validateHarnessedCopy(params.role, repaired.headline, repaired.body)
  if (!validation.passed) {
    repaired = repairRenderableCopy({
      headline: repaired.headline,
      body: buildHarnessFallbackBody(params.topic, params.role),
      constraints: {
        maxHeadlineChars: contract.maxHeadlineChars,
        maxBodyChars: contract.maxBodyChars,
        maxBodyLines: contract.maxBodyLines,
        lineLength: contract.lineLength,
      },
    })
    issues.push('body replaced with harness fallback')
  }

  return {
    headline: repaired.headline,
    body: repaired.body,
    issues,
  }
}

export function validateHarnessedCopy(role: string | undefined, headline: string, body: string) {
  const contract = getCardHarnessContract(role)
  const issues: string[] = []
  const renderable = validateRenderableCopy({
    headline,
    body,
    constraints: {
      maxHeadlineChars: contract.maxHeadlineChars,
      maxBodyChars: contract.maxBodyChars,
      maxBodyLines: contract.maxBodyLines,
      lineLength: contract.lineLength,
    },
  })
  issues.push(...renderable.issues)
  if (headline.length + body.length > contract.maxTotalChars) {
    issues.push(`copy exceeds total harness length ${contract.maxTotalChars}`)
  }
  if (containsMetaToken(`${headline} ${body}`)) {
    issues.push('copy leaks internal planning metadata')
  }
  if (contract.requiresAction && !hasActionCue(body)) {
    issues.push('closing copy lacks an explicit action cue')
  }
  return {
    passed: issues.length === 0,
    issues,
    lines: wrapForRender(body, contract.lineLength),
  }
}

function containsMetaToken(value: string) {
  return HARNESSED_COPY_META_TOKENS.some(token => value.includes(token)) ||
    /[A-Za-z]{3,}\s*은\(는\)/.test(value)
}

function hasActionCue(value: string) {
  return /저장|확인|체크|비교|다시 보기|꺼내보|살펴보|정리해두/.test(value)
}

function buildActionBody(topic: string) {
  const subject = compactSubject(topic)
  return `${subject}: 저장해두고 기준부터 다시 확인하세요.`
}

function buildHarnessFallbackBody(topic: string, role: string) {
  const subject = compactSubject(topic)
  switch (role) {
    case 'hook':
      return `${subject}: 첫 선택 기준이 흔들리면 결과도 흔들립니다.`
    case 'context':
    case 'problem':
      return `${subject}: 실제 상황과 기준을 함께 봐야 판단이 쉬워집니다.`
    case 'key-point':
    case 'detail':
    case 'stat':
      return `${subject}: 핵심 기준 하나를 정해 비교하면 선택이 빨라집니다.`
    case 'summary':
      return `${subject}: 기준, 상황, 다음 행동만 기억하면 충분합니다.`
    case 'save-cta':
    case 'cta':
      return buildActionBody(subject)
    default:
      return `${subject}은 바로 적용할 기준을 짧게 남겨야 저장할 이유가 생깁니다.`
  }
}

function compactSubject(topic: string) {
  const normalized = normalizeCopy(topic)
    .replace(/^(초보자를 위한|소상공인을 위한|신입 마케터를 위한)\s*/u, '')
    .replace(/\s*(고르는 법|작성법|운영법|관리법|보관법|체크할 것|구성법|생활 습관|순서)$/u, '')
    .replace(/\s*(줄이는|높이는|망치는|위한)$/u, '')
    .replace(/[은는이가을를]$/u, '')
    .trim()
  return normalized || topic
}

function normalizeCopy(value: string) {
  return String(value || '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
