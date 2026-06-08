/**
 * Shared copy style anti-patterns and guidance.
 *
 * These rules address the most common weaknesses observed in generated card news:
 * - Headlines that read like news anchors instead of scroll-stoppers
 * - Body copy that sounds like a briefing report instead of a conversation
 * - Repetitive ending patterns across slides
 */

// ─── Headline anti-patterns ─────────────────────────────────────────────────

export const HEADLINE_ANTI_PATTERNS = [
  '~보면 놓칩니다',
  '~한줄로 읽기',
  '~저장해두세요',
  '~체크해보세요',
  '~한 번에 이해하기',
  '~핵심만 정리',
  '~이렇게 보세요',
]

export const HEADLINE_ANTI_PATTERNS_EN = [
  'at a glance',
  'here\'s what to know',
  'everything you need',
  'what you should know',
]

// ─── Body copy anti-patterns ────────────────────────────────────────────────

export const BODY_ANTI_PATTERNS = [
  '보도에 따르면',
  '발표에 따르면',
  '자료에 따르면',
  '이 흐름 저장해두고',
  '저장해두고 다음',
  '다음 ~도 체크해보세요',
  '체크해보세요',
  '이 프레임으로 체크',
  '이 구조로 보세요',
  '기억할 문장은',
]

export const BODY_ANTI_PATTERNS_EN = [
  'according to reports',
  'according to the data',
  'save this for later',
  'worth remembering',
]

// ─── Shared prompt section builders ─────────────────────────────────────────

export function buildHeadlineStyleGuidance(language: 'ko' | 'en' = 'ko'): string {
  if (language === 'en') {
    return `Headline style rules — make readers STOP scrolling:
- Lead with a bold, specific claim or counterintuitive angle — not a summary label
- Use active verbs and concrete nouns. No passive "here's what to know" framing
- Banned patterns: ${HEADLINE_ANTI_PATTERNS_EN.join(', ')}
- Good headline test: would a friend screenshot this and send it to someone?
- Vary structure: question, bold claim, number + insight, "why X is really Y"
- Each headline must feel different — never repeat the same sentence pattern twice`
  }
  return `헤드라인 스타일 규칙 — 스크롤을 멈추게 쓰세요:
- "요약 라벨"이 아니라 대담하고 구체적인 주장이나 반전 앵글로 시작하세요
- 능동어와 구체 명사를 사용하세요. "~정리", "~보면" 같은 정보 전달형 프레임 금지
- 금지 패턴: ${HEADLINE_ANTI_PATTERNS.join(', ')}
- 좋은 헤드라인 테스트: 친구가 이거 보고 스크린샷 찍어서 친구한테 보낼까?
- 구조를 다양하게: 질문형, 대담한 주장, 숫자+인사이트, "왜 X는 사실 Y인가"
- 각 헤드라인은 다른 문장 패턴을 사용하세요 — 같은 구조 반복 금지`
}

export function buildBodyStyleGuidance(language: 'ko' | 'en' = 'ko'): string {
  if (language === 'en') {
    return `Body copy style rules — write like you're texting a smart friend:
- Conversational, not editorial. No "according to reports" or "the data shows"
- Each slide = one sharp insight delivered with personality
- Vary sentence endings: don't repeat the same grammatical pattern
- Banned patterns: ${BODY_ANTI_PATTERNS_EN.join(', ')}
- Use direct address ("you", "your") and contractions naturally
- End with a punchline, a question that makes them think, or a concrete takeaway
- The last slide must NOT use "save this" or "check this out" — find a fresh CTA angle`
  }
  return `본문 스타일 규칙 — 에디토리얼 톤으로 날카롭게 쓰세요:
- 뉴스 앵커처럼 정보를 전달하지 마세요. "보도에 따르면", "발표에 따르면" 같은 번역투 금지
- 각 슬라이드는 하나의 날카로운 인사이트를 전달하세요. 추상 문구가 아니라 구체적 사실, 이유, 판단 기준을 담으세요
- 문장 어미를 다양하게 하세요. 매번 "~입니다/~있습니다"로 끝나면 안 됩니다. 하지만 대화체("~잖아요", "~라고요?")도 피하세요. 에디토리얼 톤을 유지하면서 문장 구조를 다양하게 하세요
- 금지 패턴: ${BODY_ANTI_PATTERNS.join(', ')}
- 마지막 문장은 펀치라인, 생각하게 만드는 질문, 또는 구체적 행동 기준으로 끝내세요
- 마지막 슬라이드에 "저장해두고", "체크해보세요" 클리셰 절대 금지 — 새로운 CTA 앵글을 찾으세요`
}

/**
 * Compact anti-pattern list for inline inclusion in prompts.
 */
export function buildAntiPatternRule(language: 'ko' | 'en' = 'ko'): string {
  if (language === 'en') {
    return `Anti-patterns — NEVER use these phrases or structures:
Headline: ${HEADLINE_ANTI_PATTERNS_EN.join(', ')}
Body: ${BODY_ANTI_PATTERNS_EN.join(', ')}
Also avoid: repeating "save this for later" / "check this out" as closing CTA on multiple slides.`
  }
  return `반복 금지 — 아래 패턴과 표현을 절대 사용하지 마세요:
헤드라인: ${HEADLINE_ANTI_PATTERNS.join(', ')}
본문: ${BODY_ANTI_PATTERNS.join(', ')}
마무리: "저장해두고", "체크해보세요"를 여러 슬라이드에서 반복하지 마세요.`
}
