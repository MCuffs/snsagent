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
  let headline = normalizeCopy(params.headline)
  let body = normalizeCopy(params.body)

  if (containsMetaToken(`${headline} ${body}`)) {
    body = buildHarnessFallbackBody(params.topic, params.role)
    issues.push('body replaced because it leaked planning metadata')
  }

  if (hasBrokenHeadline(headline)) {
    headline = buildHarnessFallbackHeadline(params.topic, params.role)
    issues.push('headline replaced because it was incomplete')
  }

  if (hasBrokenKoreanCopy(body)) {
    body = buildHarnessFallbackBody(params.topic, params.role)
    issues.push('body replaced because Korean copy was incomplete')
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
      headline: hasBrokenHeadline(repaired.headline)
        ? buildHarnessFallbackHeadline(params.topic, params.role)
        : repaired.headline,
      body: buildHarnessFallbackBody(params.topic, params.role),
      constraints: {
        maxHeadlineChars: contract.maxHeadlineChars,
        maxBodyChars: contract.maxBodyChars,
        maxBodyLines: contract.maxBodyLines,
        lineLength: contract.lineLength,
      },
    })
    issues.push('copy replaced with harness fallback')
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
  if (hasBrokenHeadline(headline)) {
    issues.push('headline is incomplete or reads like a clipped phrase')
  }
  if (hasBrokenKoreanCopy(body)) {
    issues.push('body has broken Korean spacing, particles, or clipped predicate')
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
  return /저장|확인|체크|비교|다시 보기|꺼내보기|정리해두/.test(value)
}

function buildActionBody(topic: string) {
  const subject = compactSubject(topic)
  return `${subject} 기준을 저장해두고 먹기 전 다시 확인하세요.`
}

function buildHarnessFallbackBody(topic: string, role: string) {
  const subject = compactSubject(topic)
  switch (role) {
    case 'hook':
      return `${subject}는 양과 보관 기준을 함께 봐야 선택이 쉬워집니다.`
    case 'context':
    case 'problem':
      return `${subject}는 건강 이슈보다 먹는 양과 상황을 먼저 확인하세요.`
    case 'key-point':
    case 'detail':
    case 'stat':
      return `${subject}는 한 번에 많이 먹기보다 하루 분량을 정해두세요.`
    case 'summary':
      return `${subject}는 양, 보관, 먹는 시간을 함께 보면 충분합니다.`
    case 'save-cta':
    case 'cta':
      return buildActionBody(subject)
    default:
      return `${subject}는 기준을 정해두면 일상에서 더 쉽게 활용됩니다.`
  }
}

function buildHarnessFallbackHeadline(topic: string, role: string) {
  const subject = compactSubject(topic)
  switch (role) {
    case 'hook':
      return trimHeadline(`${subject}, 기준부터 보세요`)
    case 'context':
    case 'problem':
      return trimHeadline(`${subject}가 헷갈린다면`)
    case 'summary':
    case 'save-cta':
    case 'cta':
      return trimHeadline(`${subject} 기준 저장`)
    default:
      return trimHeadline(`${subject} 선택 기준`)
  }
}

function compactSubject(topic: string) {
  const normalized = normalizeCopy(topic)
  const food = normalized.match(/호두|아몬드|캐슈|피스타치오|견과류|견과/u)
  if (food?.[0]) return food[0]

  const cleaned = normalized
    .replace(/카드뉴스|콘텐츠|본문|소개|추천|효능|효과|장점|특징|건강|뉴스|많은데|많아질수록|관리|이야기|기준|방법|가이드/g, ' ')
    .replace(/\b(왜|자주|언급되는지|언급되는|한|번쯤|볼)\b/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned.split(/\s+/).find(token => /^[가-힣A-Za-z0-9]{2,12}$/.test(token)) || '핵심'
}

function normalizeCopy(value: string) {
  return String(value || '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasBrokenHeadline(value: string) {
  const normalized = normalizeCopy(value)
  if (!normalized) return true
  if (/[,:，]\s*[가-힣A-Za-z0-9]{1,10}$/.test(normalized) && !/[?？!！]$/.test(normalized)) return true
  if (/(많은데|많아질수록|언급되는|대해|위한|하는|되는|볼|할|둘)\s*$/.test(normalized)) return true
  if (/(은|는|이|가|을|를|의|와|과|에서|부터|까지|처럼|보다|만|도)\s*$/.test(normalized)) return true
  return false
}

function hasBrokenKoreanCopy(value: string) {
  const normalized = normalizeCopy(value)
  if (!normalized) return true
  if (/\b지\s+한\s+번쯤\b/.test(normalized)) return true
  if (/언급되는\s+지/.test(normalized)) return true
  if (/(볼|볼게|볼까요|볼 수|확인할|체크할|비교할|먹을|둘|정할|고를|살필|챙길)[.!?。！？]$/.test(normalized)) return true
  if (/(은|는|이|가|을|를|의|와|과|에서|부터|까지|처럼|보다|만|도)[.!?。！？]$/.test(normalized)) return true
  if (/(때문에|많아질수록|언급될수록|하려면|한다면|보려면|고르면|먹으면)[.!?。！？]$/.test(normalized)) return true
  if (/^[가-힣]{1,2}\s/.test(normalized)) return true
  return false
}

function trimHeadline(value: string) {
  return Array.from(normalizeCopy(value)).slice(0, 20).join('')
}
