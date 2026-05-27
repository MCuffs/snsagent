import type { SlideCopy, SlideRole } from '../carousel/types'
import { SYSTEM_BANNED_PHRASES, type CopyKnowledgeContext } from './copyKnowledgeBase'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CopyQualityCode =
  | 'BANNED_PHRASE'
  | 'AI_CLICHE'
  | 'HOOK_PATTERN_MISMATCH'
  | 'NARRATIVE_BREAK'
  | 'DUPLICATE_MESSAGE'
  | 'HEADLINE_TOO_VAGUE'
  | 'MISSING_EMOTIONAL_TRIGGER'
  | 'PERSONA_TONE_MISMATCH'
  | 'CTA_MISSING'

export interface CopyQualityIssue {
  slideNumber: number
  severity: 'block' | 'warn'
  code: CopyQualityCode
  message: string
  suggestion: string
}

export interface CopyQualityReport {
  passed: boolean
  score: number
  issues: CopyQualityIssue[]
  narrativeFlowScore: number
  personaFitScore: number
  hookPatternScore: number
}

// ─── Cliché patterns from KB v2 ───────────────────────────────────────────────

const AI_CLICHE_PATTERNS: string[] = [
  ...SYSTEM_BANNED_PHRASES,
  '여러분의 일상',
  '함께하는 특별한',
  '새로운 차원의',
  '완벽한 선택',
  '최고의 경험',
  '혁신적인 솔루션',
  '당신만을 위한',
  '지금 바로 만나보세요',
  '오늘부터 시작하세요',
  '더 나은 미래',
  '스마트한 선택',
  '고객에게 특별한 가치',
  '라이프스타일에 관심이 있는',
]

// Patterns that indicate vague, non-specific copy
const VAGUE_PATTERN_RE = /^(좋은|멋진|훌륭한|특별한|다양한|여러|많은|큰|작은)\s/

// CTA action words expected on last slide
const CTA_ACTION_RE = /저장|확인|문의|구매|보기|링크|클릭|방문|신청|체험/

// ─── Main Checker ─────────────────────────────────────────────────────────────

export function checkCopyQuality(
  slides: SlideCopy[],
  ctx: CopyKnowledgeContext,
  structure: Array<{ slideNumber: number; role: SlideRole }>
): CopyQualityReport {
  const allIssues: CopyQualityIssue[] = []
  const roleMap = new Map(structure.map(s => [s.slideNumber, s.role]))

  // Collect all headlines for duplicate detection
  const headlines = slides.map(s => normalizeText(s.headline))

  slides.forEach((slide, index) => {
    const role = roleMap.get(slide.slideNumber) ?? 'feature'
    const previous = index > 0 ? slides[index - 1] : undefined
    const issues = checkSingleSlide(slide, role, ctx, previous)
    allIssues.push(...issues)
  })

  // Duplicate message detection across slides
  const duplicates = findDuplicateMessages(headlines)
  duplicates.forEach(({ slideNumbers }) => {
    slideNumbers.slice(1).forEach(num => {
      allIssues.push({
        slideNumber: num,
        severity: 'warn',
        code: 'DUPLICATE_MESSAGE',
        message: `슬라이드 ${slideNumbers[0]}과 헤드라인이 중복됩니다`,
        suggestion: '각 슬라이드는 고유한 메시지를 전달해야 합니다',
      })
    })
  })

  // CTA check on last slide
  const lastSlide = slides[slides.length - 1]
  if (lastSlide) {
    const lastRole = roleMap.get(lastSlide.slideNumber)
    if (lastRole === 'cta' || lastRole === 'offer') {
      const combined = `${lastSlide.headline} ${lastSlide.body} ${lastSlide.ctaText ?? ''}`
      if (!CTA_ACTION_RE.test(combined)) {
        allIssues.push({
          slideNumber: lastSlide.slideNumber,
          severity: 'warn',
          code: 'CTA_MISSING',
          message: '마지막 슬라이드에 행동 유도 문구가 없습니다',
          suggestion: `"${ctx.industryToneRule?.ctaStyle ?? '저장해두세요'}"와 같은 자연스러운 CTA를 추가하세요`,
        })
      }
    }
  }

  // Scoring
  const blockCount = allIssues.filter(i => i.severity === 'block').length
  const warnCount = allIssues.filter(i => i.severity === 'warn').length
  const baseScore = 100 - blockCount * 15 - warnCount * 5
  const score = Math.max(0, Math.min(100, baseScore))

  const narrativeFlowScore = calcNarrativeFlowScore(slides, structure)
  const personaFitScore = calcPersonaFitScore(slides, ctx)
  const hookPatternScore = calcHookPatternScore(slides[0], ctx)

  return {
    passed: blockCount === 0 && score >= 70,
    score,
    issues: allIssues,
    narrativeFlowScore,
    personaFitScore,
    hookPatternScore,
  }
}

export function checkSingleSlide(
  slide: SlideCopy,
  role: SlideRole,
  ctx: CopyKnowledgeContext,
  previousSlide?: SlideCopy
): CopyQualityIssue[] {
  const issues: CopyQualityIssue[] = []
  const combined = `${slide.headline} ${slide.body}`

  // 1. Banned phrases (block)
  for (const phrase of ctx.resolvedBannedPhrases) {
    if (combined.includes(phrase)) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'block',
        code: 'BANNED_PHRASE',
        message: `금지 표현 감지: "${phrase}"`,
        suggestion: `"${phrase}"를 제거하고 구체적인 상황/맥락으로 대체하세요`,
      })
    }
  }

  // 2. AI clichés (block)
  for (const cliche of AI_CLICHE_PATTERNS) {
    if (combined.includes(cliche) && !ctx.resolvedBannedPhrases.includes(cliche)) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'block',
        code: 'AI_CLICHE',
        message: `AI 클리셰 감지: "${cliche}"`,
        suggestion: `훅 패턴 ${ctx.selectedHookPatterns[0]?.templateKr ?? '구체적 패턴'}을 참고해 다시 작성하세요`,
      })
    }
  }

  // 3. Hook pattern mismatch on slide 1 (warn)
  if (role === 'hook' && ctx.selectedHookPatterns.length > 0) {
    const primary = ctx.selectedHookPatterns[0]
    const personaAvoid = ctx.personaProfile.avoidWords
    const hasPersonaAvoid = personaAvoid.some(w => combined.includes(w))
    if (hasPersonaAvoid) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'warn',
        code: 'HOOK_PATTERN_MISMATCH',
        message: `이 페르소나(${ctx.personaProfile.id})가 거부하는 표현이 포함되어 있습니다`,
        suggestion: `훅 패턴 "${primary.id}" 템플릿을 참고해 페르소나에 맞게 재작성하세요`,
      })
    }
  }

  // 4. Vague headline (warn)
  if (VAGUE_PATTERN_RE.test(slide.headline)) {
    issues.push({
      slideNumber: slide.slideNumber,
      severity: 'warn',
      code: 'HEADLINE_TOO_VAGUE',
      message: '헤드라인이 너무 모호합니다',
      suggestion: '구체적인 숫자, 상황, 또는 대상을 포함해 재작성하세요',
    })
  }

  // 5. Narrative break detection — check if previous and current are too similar (warn)
  if (previousSlide) {
    const prevNorm = normalizeText(`${previousSlide.headline} ${previousSlide.body}`)
    const currNorm = normalizeText(combined)
    if (cosineSimilarityApprox(prevNorm, currNorm) > 0.7) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'warn',
        code: 'NARRATIVE_BREAK',
        message: '이전 슬라이드와 내용이 너무 유사합니다',
        suggestion: '서사 흐름에 따라 새로운 정보나 감정 전환이 필요합니다',
      })
    }
  }

  // 6. Persona tone mismatch — corpo tone for persona that rejects it (warn)
  const corpoWords = ['제공합니다', '구성되어 있습니다', '설계되었습니다', '지원합니다', '개발하였습니다']
  const isCorpo = corpoWords.some(w => combined.includes(w))
  if (isCorpo && ['trend_curator', 'community_sharer'].includes(ctx.personaProfile.id)) {
    issues.push({
      slideNumber: slide.slideNumber,
      severity: 'warn',
      code: 'PERSONA_TONE_MISMATCH',
      message: `페르소나(${ctx.personaProfile.id})에게 기업체 문체가 어색합니다`,
      suggestion: '구어체로 바꾸고 페르소나의 trigger words를 활용하세요',
    })
  }

  return issues
}

// ─── Score Calculators ────────────────────────────────────────────────────────

function calcNarrativeFlowScore(
  slides: SlideCopy[],
  structure: Array<{ slideNumber: number; role: SlideRole }>
): number {
  if (slides.length < 2) return 100
  let score = 100
  const roleMap = new Map(structure.map(s => [s.slideNumber, s.role]))

  slides.forEach((slide, i) => {
    if (i === 0) return
    const prev = slides[i - 1]
    const prevNorm = normalizeText(`${prev.headline} ${prev.body}`)
    const currNorm = normalizeText(`${slide.headline} ${slide.body}`)
    const similarity = cosineSimilarityApprox(prevNorm, currNorm)
    if (similarity > 0.7) score -= 15
    else if (similarity > 0.5) score -= 5

    // Hook slide should be shortest
    const role = roleMap.get(slide.slideNumber)
    if (role === 'cta' && slide.headline.length > 16) score -= 5
  })

  return Math.max(0, score)
}

function calcPersonaFitScore(slides: SlideCopy[], ctx: CopyKnowledgeContext): number {
  const allText = slides.map(s => `${s.headline} ${s.body}`).join(' ')
  const triggerCount = ctx.personaProfile.triggerWords.filter(w => allText.includes(w)).length
  const avoidCount = ctx.personaProfile.avoidWords.filter(w => allText.includes(w)).length

  const score = 70 + triggerCount * 5 - avoidCount * 10
  return Math.max(0, Math.min(100, score))
}

function calcHookPatternScore(firstSlide: SlideCopy | undefined, ctx: CopyKnowledgeContext): number {
  if (!firstSlide || !ctx.selectedHookPatterns.length) return 50
  const primaryPattern = ctx.selectedHookPatterns[0]
  const text = `${firstSlide.headline} ${firstSlide.body}`

  // Check emotional trigger words
  const emotionProfile = ctx.emotionalIntentProfile
  const triggerCount = emotionProfile.koreanTriggerPhrases.filter(p => text.includes(p)).length
  const avoidCount = emotionProfile.avoidPhrases.filter(p => text.includes(p)).length

  // Check if hook type signal is present
  const hookTypeSignals: Record<string, string[]> = {
    curiosity: ['몰랐', '왜', '이유', '사실', '비밀', '알고'],
    pain_point: ['불편', '고민', '힘들', '어렵', '실수', '문제'],
    benefit: ['바뀌', '달라', '좋아', '됩니다', '가능'],
    urgency: ['지금', '오늘', '한정', '마지막', '이때'],
    comparison: ['비슷', '다릅니다', '차이', '보다', '반면'],
    social_proof: ['다들', '요즘', '후기', '사람들', '많이'],
  }
  const signals = hookTypeSignals[primaryPattern.hookType] ?? []
  const signalCount = signals.filter(s => text.includes(s)).length

  const score = 60 + triggerCount * 8 + signalCount * 6 - avoidCount * 10
  return Math.max(0, Math.min(100, score))
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

function cosineSimilarityApprox(a: string, b: string): number {
  const setA = new Set(a.split(''))
  const setB = new Set(b.split(''))
  const intersection = [...setA].filter(c => setB.has(c)).length
  const union = new Set([...setA, ...setB]).size
  return union === 0 ? 0 : intersection / union
}

function findDuplicateMessages(headlines: string[]): { slideNumbers: number[] }[] {
  const groups: Map<string, number[]> = new Map()
  headlines.forEach((h, i) => {
    const key = h.slice(0, 10) // rough dedup by first 10 chars
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(i + 1)
  })
  return [...groups.values()]
    .filter(nums => nums.length > 1)
    .map(nums => ({ slideNumbers: nums }))
}
