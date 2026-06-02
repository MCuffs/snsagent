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
  return /저장|확인|체크|비교|다시 보기|꺼내보기|정리해두|점검/.test(value)
}

function buildActionBody(topic: string) {
  const subject = compactSubject(topic)
  if (subject === '첫 화면') return '첫 화면 점검 기준을 저장해두고 수정 전에 한 번 더 확인하세요.'
  if (subject === '카드뉴스 제목') return '제목 점검 기준을 저장해두고 발행 전에 한 번 더 확인하세요.'
  if (subject === '아침 루틴') return '아침 루틴 기준을 저장해두고 내일 아침 실천 여부를 확인하세요.'
  if (subject === '비 오는 러닝') return '러닝 안전 기준을 저장해두고 나가기 전에 한 번 더 확인하세요.'
  return `${subject} 기준을 저장해두고 다음에 고를 때 바로 꺼내서 확인하세요.`
}

function buildHarnessFallbackBody(topic: string, role: string) {
  const subject = compactSubject(topic)
  const contextual = buildContextualFallbackBody(subject, role)
  if (contextual) return contextual

  switch (role) {
    case 'hook':
      return `${subject}는 양과 보관 기준을 함께 봐야 일상에서 고르기가 더 쉬워집니다.`
    case 'context':
    case 'problem':
      return `${subject}는 건강 효과보다 먹는 양과 상황을 먼저 정해두는 게 중요합니다.`
    case 'key-point':
    case 'detail':
    case 'stat':
      return `${subject}는 한 번에 많이 먹기보다 소량씩 나눠 꾸준히 챙기는 편이 좋습니다.`
    case 'summary':
      return `${subject}는 양과 보관, 먹는 시간 세 가지를 함께 정해두면 충분합니다.`
    case 'save-cta':
    case 'cta':
      return buildActionBody(subject)
    default:
      return `${subject}는 기준을 정해두면 매일 꺼내 쓰기가 훨씬 더 편해집니다.`
  }
}

function buildContextualFallbackBody(subject: string, role: string) {
  if (/호두|아몬드|캐슈|피스타치오|견과류|견과/u.test(subject)) {
    switch (role) {
      case 'hook':
        return `${subject}는 건강 뉴스보다 하루 적정 분량과 먹는 상황부터 먼저 확인하세요.`
      case 'context':
      case 'problem':
        return `${subject}가 자주 언급되는 건 부담 없이 챙기기 좋은 간식이기 때문입니다.`
      case 'key-point':
      case 'detail':
      case 'stat':
        return `${subject}는 한 번에 많이 먹기보다 정해둔 양을 매일 꾸준히 먹는 편이 좋습니다.`
      case 'summary':
        return `${subject}는 효능보다 양과 보관, 먹는 시간을 함께 정해두는 것이 핵심입니다.`
      case 'save-cta':
      case 'cta':
        return buildActionBody(subject)
      default:
        return `${subject}는 기준을 정해두면 매일 꺼내 먹기가 훨씬 더 쉬워집니다.`
    }
  }

  if (subject === '첫 화면') {
    switch (role) {
      case 'hook':
        return '첫 화면은 고객 상황과 대표 혜택이 바로 보여야 멈춰 읽습니다.'
      case 'context':
      case 'problem':
        return '고객은 첫 화면에서 내게 필요한 상품인지 몇 초 안에 판단합니다.'
      case 'key-point':
      case 'detail':
      case 'stat':
        return '첫 화면에는 대상, 사용 장면, 확인 항목을 한 줄로 보여주세요.'
      case 'summary':
        return '첫 화면은 장점 나열보다 고객 장면 하나가 더 설득력 있습니다.'
      case 'save-cta':
      case 'cta':
        return buildActionBody(subject)
      default:
        return '첫 화면은 고객이 바로 이해할 한 문장부터 정리해야 합니다.'
    }
  }

  if (subject === '카드뉴스 제목') {
    switch (role) {
      case 'hook':
        return '제목은 독자가 얻을 결과를 먼저 보여줘야 멈춰 읽습니다.'
      case 'context':
      case 'problem':
        return '막연한 제목은 좋은 내용도 그냥 넘기게 만듭니다.'
      case 'key-point':
      case 'detail':
      case 'stat':
        return '제목에는 대상, 상황, 얻을 점 중 하나를 반드시 넣으세요.'
      case 'summary':
        return '제목은 멋진 표현보다 읽을 이유가 먼저 보여야 합니다.'
      case 'save-cta':
      case 'cta':
        return buildActionBody(subject)
      default:
        return '카드뉴스 제목은 누가 왜 읽어야 하는지 짧게 보여줘야 합니다.'
    }
  }

  if (subject === '아침 루틴') {
    switch (role) {
      case 'hook':
        return '아침 루틴은 거창한 계획보다 작은 행동 하나가 먼저입니다.'
      case 'context':
      case 'problem':
        return '출근 전 시간이 짧을수록 루틴은 더 작게 시작해야 합니다.'
      case 'key-point':
      case 'detail':
      case 'stat':
        return '알람 뒤 바로 할 행동 하나만 정하면 반복 가능성이 높아집니다.'
      case 'summary':
        return '아침 루틴은 시간, 장소, 첫 행동만 정해도 충분합니다.'
      case 'save-cta':
      case 'cta':
        return buildActionBody(subject)
      default:
        return '아침 루틴은 매일 반복할 수 있는 작은 기준부터 잡아야 합니다.'
    }
  }

  if (subject === '비 오는 러닝') {
    switch (role) {
      case 'hook':
        return '비 오는 러닝은 의지보다 노면과 시야 확인이 먼저입니다.'
      case 'context':
      case 'problem':
        return '비가 오면 속도보다 미끄러운 구간과 귀가 동선을 봐야 합니다.'
      case 'key-point':
      case 'detail':
      case 'stat':
        return '출발 전 노면, 조명, 신발 접지력을 먼저 확인하세요.'
      case 'summary':
        return '비 오는 날은 짧은 코스와 안전한 귀가 기준이면 충분합니다.'
      case 'save-cta':
      case 'cta':
        return buildActionBody(subject)
      default:
        return '비 오는 러닝은 계속하는 마음보다 안전 기준이 먼저입니다.'
    }
  }

  return null
}

function buildHarnessFallbackHeadline(topic: string, role: string) {
  const subject = compactSubject(topic)
  switch (role) {
    case 'hook':
      return trimHeadline(`${subject}, 기준부터 보세요`)
    case 'context':
    case 'problem':
      return trimHeadline(`${subject}${subjectParticle(subject)} 헷갈린다면`)
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
  if (food?.[0]) {
    // Use up to 8 chars of the topic so the fallback sentence stays natural
    const trimmed = normalized.slice(0, 8).trim()
    return trimmed || food[0]
  }
  if (/비\s*오는|러닝|달리기/u.test(normalized)) return '비 오는 러닝'
  if (/아침|루틴/u.test(normalized)) return '아침 루틴'
  if (/신입|마케터|제목|카드뉴스/u.test(normalized)) return '카드뉴스 제목'
  if (/쇼핑몰|첫\s*화면|소상공인/u.test(normalized)) return '첫 화면'

  const cleaned = normalized
    .replace(/카드뉴스|콘텐츠|본문|소개|추천|효능|효과|장점|특징|건강|뉴스|많은데|많아질수록|관리|이야기|기준|방법|가이드/g, ' ')
    .replace(/\b(왜|자주|언급되는지|언급되는|한|번쯤|볼|오는|위한|사람|직장인|싶은)\b/g, ' ')
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

function trimHeadline(value: string) {
  return Array.from(normalizeCopy(value)).slice(0, 20).join('')
}

function subjectParticle(subject: string) {
  const last = Array.from(subject).at(-1)
  if (!last) return '이'
  const code = last.charCodeAt(0)
  if (code < 0xac00 || code > 0xd7a3) return '이'
  return (code - 0xac00) % 28 === 0 ? '가' : '이'
}
