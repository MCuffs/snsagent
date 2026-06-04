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
  const headline = normalizeCopy(params.headline)
  const body = normalizeCopy(params.body)

  if (containsMetaToken(`${headline} ${body}`)) {
    issues.push('body leaks planning metadata')
  }

  if (hasBrokenHeadline(headline)) {
    issues.push('headline is incomplete')
  }

  if (hasBrokenKoreanCopy(body)) {
    issues.push('body has incomplete Korean copy')
  }

  if (contract.requiresAction && !hasActionCue(body)) {
    issues.push('CTA action cue is missing')
  }

  const repaired = repairRenderableCopy({
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
    issues.push(...validation.issues)
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
  return /저장|확인|체크|비교|다시 보기|꺼내보기|정리해두|점검/.test(value)
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
  if (/[A-Za-z]{3,}/.test(normalized)) return true
  if (/^(오는|비|신입|아침)\s*기준\s*저장$/.test(normalized)) return true
  if (/만들고 싶은|싶은 루틴|온라인 쇼핑몰 첫$|소상공인이 온라인|(첫 화면|아침 루틴|비 오는 러닝|카드뉴스 제목)가/.test(normalized)) return true
  if (/인스타그램\s*카드뉴스$/.test(normalized)) return true
  if (/[,:，]\s*[가-힣A-Za-z0-9]{1,10}$/.test(normalized) && !/[?？!！]$/.test(normalized)) return true
  if (/(많은데|많아질수록|언급되는|대해|위한|하는|되는|볼|할|둘|첫)\s*$/.test(normalized)) return true
  if (/(은|는|이|가|을|를|의|와|과|에서|부터|까지|처럼|보다|만|도)\s*$/.test(normalized)) return true
  return false
}

function hasBrokenKoreanCopy(value: string) {
  const normalized = normalizeCopy(value)
  if (!normalized) return true
  if (/[A-Za-z]{3,}/.test(normalized)) return true
  if (/^[가-힣A-Za-z]{1,8}:\s*/.test(normalized)) return true
  if (/(첫 화면|아침 루틴|비 오는 러닝|카드뉴스 제목)는/.test(normalized)) return true
  if (/(첫 화면|아침 루틴|비 오는 러닝|카드뉴스 제목).*(먹기|보관|섭취량|하루 분량|양과 보관|양, 보관)/.test(normalized)) return true
  if (/쓰는 전|하루\s*한[.!?。！？]$/.test(normalized)) return true
  if (/오는 비|자주 보여[.!?。！？]?$/.test(normalized)) return true
  if (/다음\s*장/.test(normalized)) return true
  if (/핵심 정보와 실천 기준/.test(normalized)) return true
  if (/(한|바|게|정하|다음|이미|같게|쉽게|시야|많은지|는지|고르고|준비|판단|보여야|붙여야|밑창|쉬운지|쉽기|떠올라|반짝임|코스|장면|문제|결과|상황|기준|읽히|이유|훨씬|있는지|가능성|위험|클릭|3초 안)[.!?。！？]$/.test(normalized)) return true
  if (/\b지\s+한\s+번쯤\b/.test(normalized)) return true
  if (/언급되는\s+지/.test(normalized)) return true
  if (/(확인하고|이해가 가장)[.!?。！？]$/.test(normalized)) return true
  if (/[.!?。！？]$/.test(normalized) && !/(?:다|요|죠|세요|십시오|니다|습니다)[.!?。！？]$/.test(normalized)) return true
  if (/(볼|볼게|볼까요|볼 수|확인할|체크할|비교할|먹을|둘|정할|고를|살필|챙길)[.!?。！？]$/.test(normalized)) return true
  if (/(은|는|이|가|을|를|의|와|과|에서|부터|까지|처럼|보다|만|도)[.!?。！？]$/.test(normalized)) return true
  if (/(때문에|많아질수록|언급될수록|하려면|한다면|보려면|고르면|먹으면)[.!?。！？]$/.test(normalized)) return true
  return false
}
