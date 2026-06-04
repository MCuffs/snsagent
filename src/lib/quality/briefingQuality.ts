export interface BriefingQualityInput {
  text: string
  language?: 'ko' | 'en'
  generationMode?: 'brand' | 'general'
  hasUrl?: boolean
}

export interface BriefingQualityResult {
  score: number
  missing: Array<'subject' | 'audience' | 'angle' | 'purpose' | 'evidence' | 'action'>
  signals: string[]
  shouldClarify: boolean
}

const KO_PATTERNS = {
  audience: /타겟|대상|누구|초보자|직장인|주부|학생|부모|고객|구매자|건강\s*관심|다이어트|운동|MZ|20대|30대|40대/u,
  angle: /관점|중심|루틴|섭취법|먹는\s*법|주의점|비교|근거|성분|오메가|식이섬유|포만감|보관|체크리스트|트렌드/u,
  purpose: /목적|저장|교육|구매|전환|인지도|팔로우|공유|정보형|홍보|유입|소장/u,
  evidence: /포함|다뤄|설명|균형|구체|실생활|장보기|간식|수치|자료|기사|뉴스|연구|출처|통계|하루|권장량/u,
  action: /저장|확인|구매|비교|체크|팔로우|공유|문의|방문|클릭/u,
}

const EN_PATTERNS = {
  audience: /target|audience|for\s+(beginners|parents|students|workers|professionals|customers|buyers|fans)|gen\s*z|millennial|health-conscious/i,
  angle: /angle|focus|routine|how to|caution|benefit|compare|comparison|ingredient|nutrition|checklist|trend|guide/i,
  purpose: /goal|purpose|educat|save|share|conversion|awareness|follow|purchase|traffic|lead/i,
  evidence: /include|cover|explain|specific|data|source|article|news|study|research|stat|serving|daily|evidence/i,
  action: /save|check|compare|buy|shop|follow|share|visit|click|contact|learn/i,
}

const GENERIC_REQUEST_RE = /카드뉴스|카드 뉴스|콘텐츠|컨텐츠|인스타그램|인스타|피드|릴스|sns|만들어줘|만들어|생성|제작|기획|추천|홍보|마케팅|브랜드|상품|주제|해줘|해주세요|부탁|card news|carousel|instagram|post|make|create|generate|content|topic/gi
const SUBJECT_HINT_RE = /[가-힣A-Za-z0-9]{2,}/u

export function evaluateBriefingQuality(input: BriefingQualityInput): BriefingQualityResult {
  const text = normalize(input.text)
  const language = input.language === 'en' ? 'en' : 'ko'
  const patterns = language === 'en' ? EN_PATTERNS : KO_PATTERNS
  const withoutUrl = text.replace(/https?:\/\/[^\s]+/g, '').trim()
  const subjectText = withoutUrl.replace(GENERIC_REQUEST_RE, ' ').replace(/\s+/g, ' ').trim()
  const hasSubject = Boolean(input.hasUrl) || SUBJECT_HINT_RE.test(subjectText)

  const signals: string[] = []
  const missing: BriefingQualityResult['missing'] = []
  let score = 0

  if (hasSubject) {
    score += 28
    signals.push('subject')
  } else {
    missing.push('subject')
  }

  for (const key of ['audience', 'angle', 'purpose', 'evidence', 'action'] as const) {
    if (patterns[key].test(text)) {
      score += key === 'angle' || key === 'evidence' ? 18 : 12
      signals.push(key)
    } else {
      missing.push(key)
    }
  }

  if (text.length >= 45) score += 8
  if (input.hasUrl) score += 15
  if (input.generationMode === 'brand' && !input.hasUrl && !patterns.evidence.test(text)) score -= 8

  const lowInformationRequest = withoutUrl.length < 45 && signals.length <= 2
  const shouldClarify = score < 56 || lowInformationRequest

  return {
    score: Math.max(0, Math.min(100, score)),
    missing,
    signals,
    shouldClarify,
  }
}

function normalize(value: string) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}
