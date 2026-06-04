/**
 * 카드뉴스 제목/본문 품질 테스트 v2
 * - 5회 순차 테스트, 매 회 실패 데이터 누적
 * - 이전 실패 패턴을 다음 테스트 프롬프트에 주입
 */

import OpenAI from 'openai'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      let val = trimmed.slice(idx + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
      if (!process.env[key]) process.env[key] = val
    }
  } catch {}
}
loadEnv(resolve(process.cwd(), '.env'))
loadEnv(resolve(process.cwd(), '.env.local'))

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || undefined
const MODEL = process.env.OPENAI_COPY_MODEL || process.env.OPENAI_TEXT_MODEL || 'gpt-4o'

if (!OPENAI_API_KEY) { console.error('❌ OPENAI_API_KEY not found'); process.exit(1) }

const openai = new OpenAI({ apiKey: OPENAI_API_KEY, ...(OPENAI_BASE_URL ? { baseURL: OPENAI_BASE_URL } : {}) })

// ─── 5가지 테스트 주제 (각기 다른 카테고리) ──────────────────────────
const TEST_CASES = [
  {
    id: 1,
    topic: '요즘 MZ세대 수면 문제',
    title: '잠 못 드는 20-30대, 원인과 해결법',
    category: '건강/라이프스타일',
    contentType: '정보 전달',
    tone: '공감적이고 실용적으로',
    keyContent: `수면 부족은 MZ세대의 가장 큰 건강 문제 중 하나다. 한국 성인의 약 30%가 불면증을 경험하고, 20-30대 직장인은 평균 수면 시간이 6시간 미만이다. 블루라이트 노출, 야간 스마트폰 사용, 불규칙한 생활 패턴이 주요 원인으로 꼽힌다. 수면 전 30분 스마트폰 끄기, 취침 시간 고정, 실내 온도 18-20도 유지가 효과적인 방법으로 알려져 있다.`,
    objective: '수면 위생 개선 인식 높이기',
  },
  {
    id: 2,
    topic: '홈트 vs 헬스장, 뭐가 더 효율적?',
    title: '홈트와 헬스장, 당신의 선택은?',
    category: '운동/피트니스',
    contentType: '비교 분석',
    tone: '친근하고 유머러스하게',
    keyContent: `홈트레이닝은 시간과 교통비를 절약할 수 있지만 자기통제가 어렵다. 헬스장은 다양한 기구와 PT 서비스가 있지만 월 5-15만원의 비용이 든다. 홈트의 경우 유튜브 운동 채널 구독자가 최근 3년간 400% 증가했다. 헬스장은 코로나 이후 회원 수가 감소했다가 2023년부터 회복세다. 운동 목표와 라이프스타일에 따라 선택이 달라진다.`,
    objective: '운동 습관 형성 동기부여',
  },
  {
    id: 3,
    topic: '2025년 직장인 커리어 체크리스트',
    title: '올해 커리어, 이것만 체크하세요',
    category: '자기계발/커리어',
    contentType: '체크리스트/가이드',
    tone: '동기부여적이고 실용적으로',
    keyContent: `직장인의 73%가 현재 직장에 불만족스럽다고 답했다(2024 직장인 설문). AI 시대에 살아남기 위해 필요한 스킬로는 데이터 분석, 프롬프트 엔지니어링, 커뮤니케이션이 꼽힌다. 이직을 고려하는 직장인의 평균 준비 기간은 6개월이다. 사이드 프로젝트 경험이 연봉 협상에 긍정적 영향을 미친다는 연구 결과도 있다.`,
    objective: '커리어 개선 행동 유도',
  },
  {
    id: 4,
    topic: '제로 웨이스트 주방 시작하기',
    title: '오늘부터 제로 웨이스트 주방',
    category: '환경/라이프스타일',
    contentType: '실천 가이드',
    tone: '따뜻하고 격려하는 톤으로',
    keyContent: `한국의 연간 음식물 쓰레기는 약 500만 톤으로 처리 비용만 8천억 원에 달한다. 밀랍 랩 사용으로 플라스틱 랩 사용을 90% 줄일 수 있다. 텀블러 사용 시 연간 플라스틱 컵 500개를 절약한다. 장 볼 때 에코백 사용, 재사용 용기 활용, 음식 낭비 줄이기가 제로 웨이스트 주방의 핵심이다.`,
    objective: '친환경 생활 습관 실천 유도',
  },
  {
    id: 5,
    topic: '재테크 첫걸음: 2025년 투자 입문',
    title: '돈 공부, 지금 시작해도 늦지 않았다',
    category: '재테크/경제',
    contentType: '입문 가이드',
    tone: '신뢰감 있고 쉽게 설명하는 톤',
    keyContent: `20-30대 중 투자 경험이 있는 비율은 65%지만, 체계적으로 공부하는 비율은 20%에 불과하다. 주식, ETF, 예금, 채권의 기본 개념 이해가 재테크의 출발점이다. 월 10만원씩 5년간 적금하면 이자 포함 약 700만원이 된다. 복리 효과를 위해 일찍 시작하는 것이 중요하며, 분산 투자가 리스크를 줄이는 기본 원칙이다.`,
    objective: '재테크 시작 동기부여',
  },
]

const SYSTEM_PROMPT = `당신은 한국 인스타그램 정보/시사/트렌드 카드뉴스 전문 에디터입니다. 제공된 자료를 객관적이고 가독성 높게 요약하여 카드뉴스 카피를 작성하세요. 유효한 JSON으로만 응답하세요.`

// ─── 품질 평가 ────────────────────────────────────────────────────────
function evaluate(slides, tc) {
  const issues = []
  const warnings = []
  let score = 100

  for (const slide of slides) {
    const hl = (slide.headline || '').trim()
    const body = (slide.body || '').trim()
    const role = getRole(slide.slideNumber)

    // 1. headline 20자 초과
    if (hl.length > 20) {
      issues.push({ type: 'headline_too_long', slide: slide.slideNumber, detail: `"${hl}" (${hl.length}자/최대 20자)` })
      score -= 10
    }

    // 2. headline 비어있음
    if (!hl) {
      issues.push({ type: 'headline_empty', slide: slide.slideNumber, detail: '빈 headline' })
      score -= 20
    }

    // 3. body 너무 짧음
    if (body.length < 30) {
      issues.push({ type: 'body_too_short', slide: slide.slideNumber, detail: `"${body}" (${body.length}자/최소 30자)` })
      score -= 15
    } else if (body.length < 42) {
      warnings.push({ type: 'body_below_recommended', slide: slide.slideNumber, detail: `${body.length}자 (권장 42자 이상)` })
      score -= 5
    }

    // 4. body 64자 초과
    if (body.length > 64) {
      issues.push({ type: 'body_too_long', slide: slide.slideNumber, detail: `"${body.slice(0, 30)}…" (${body.length}자/최대 64자)` })
      score -= 10
    }

    // 5. body 문장 미완성
    const lastChar = body.slice(-1)
    const incomplete = [',', '과', '와', '은', '는', '이', '가', '을', '를', '의', '에', '로', '으로', '(', '·', '및']
    if (incomplete.includes(lastChar)) {
      issues.push({ type: 'body_incomplete_sentence', slide: slide.slideNumber, detail: `마지막 문자 "${lastChar}" — "${body.slice(-15)}"` })
      score -= 15
    }

    // 6. body 비어있음
    if (!body) {
      issues.push({ type: 'body_empty', slide: slide.slideNumber, detail: '빈 body' })
      score -= 20
    }

    // 7. 금지 클리셰
    const cliches = ['혁신적인', '최고의', '완벽한', '생활 속 선택', '중요한 기준', '반복되는 상황', '선택 이유', '더 오래 기억']
    for (const c of cliches) {
      if (hl.includes(c) || body.includes(c)) {
        issues.push({ type: 'banned_cliche', slide: slide.slideNumber, detail: `"${c}"` })
        score -= 8
      }
    }

    // 8. 내부 기획 토큰 유출
    const leakTokens = ['STORY ONTOLOGY', 'guiding question', 'visualDirection', 'imagePurpose', 'daily use scene']
    for (const tok of leakTokens) {
      if (hl.includes(tok) || body.includes(tok)) {
        issues.push({ type: 'internal_token_leak', slide: slide.slideNumber, detail: `"${tok}"` })
        score -= 20
      }
    }

    // 9. 추상적 채움 표현
    const abstractPhrases = ['생활 속', '중요한 기준', '선택하는 이유', '더 나은 선택', '일상에서', '삶의 질', '많은 분들이']
    for (const p of abstractPhrases) {
      if (body.includes(p)) {
        warnings.push({ type: 'abstract_filler', slide: slide.slideNumber, detail: `"${p}"` })
        score -= 3
      }
    }

    // 10. save-cta 슬라이드 행동 촉구어 없음
    if (role === 'save-cta') {
      const ctaWords = ['저장', '확인', '체크', '비교', '팔로우', '공유']
      if (!ctaWords.some(w => hl.includes(w) || body.includes(w))) {
        warnings.push({ type: 'cta_missing_action', slide: slide.slideNumber, detail: '저장/확인/체크/비교 없음' })
        score -= 5
      }
    }
  }

  // 11. 슬라이드 간 body 중복
  const bodies = slides.map(s => (s.body || '').trim())
  for (let i = 1; i < bodies.length; i++) {
    const prev = bodies[i - 1], curr = bodies[i]
    if (prev.length > 10 && curr.length > 10) {
      const prevWords = new Set(prev.split(/\s+/).filter(w => w.length > 2))
      const overlap = curr.split(/\s+/).filter(w => w.length > 2 && prevWords.has(w))
      if (overlap.length >= 4) {
        warnings.push({ type: 'slide_overlap', slide: i + 1, detail: `이전 슬라이드와 중복 단어 ${overlap.length}개: ${overlap.slice(0, 4).join(', ')}` })
        score -= 3
      }
    }
  }

  // 12. "시작" 단어 과다 반복 (전체 슬라이드 기준)
  const allText = slides.map(s => `${s.headline || ''} ${s.body || ''}`).join(' ')
  const startCount = (allText.match(/시작/g) || []).length
  if (startCount >= 3) {
    warnings.push({ type: 'word_overuse', slide: null, detail: `"시작" ${startCount}회 반복` })
    score -= 4
  }

  return { score: Math.max(0, score), issues, warnings }
}

// ─── 프롬프트 빌더 (실패 누적 반영) ──────────────────────────────────
function buildPrompt(tc, failureLog) {
  const slides = [
    { slideNumber: 1, role: 'hook', purpose: '독자 시선을 즉시 잡는 훅' },
    { slideNumber: 2, role: 'problem', purpose: '문제/현상 제시' },
    { slideNumber: 3, role: 'detail', purpose: '핵심 근거/사실 전달' },
    { slideNumber: 4, role: 'detail', purpose: '실용적 해결책 또는 추가 인사이트' },
    { slideNumber: 5, role: 'save-cta', purpose: '핵심 요약 + 행동 촉구' },
  ]
  const slideDesc = slides.map(s => `슬라이드 ${s.slideNumber} [${s.role}]: ${s.purpose}`).join('\n')

  // 이전 테스트에서 발생한 실패 패턴을 추가 금지 규칙으로 주입
  const failureSection = failureLog.length > 0
    ? `\n[이전 테스트 실패 패턴 — 반드시 피하세요]\n${failureLog.map(f => `- ${f}`).join('\n')}\n`
    : ''

  return `한국 인스타그램 카드뉴스 카피를 작성해주세요.

콘텐츠 기획:
- 주제: ${tc.topic}
- 캠페인 목표: ${tc.objective}
- 콘텐츠 유형: ${tc.contentType}
- 카테고리: ${tc.category}
- 톤앤매너: ${tc.tone}

제공된 사실 및 기획 자료:
${tc.keyContent}

슬라이드 구성:
${slideDesc}
${failureSection}
규칙:
- headline: 20자 이하, 강렬하고 구체적 (공백 포함)
- body: 42~64자, 최대 2문장, 모바일 카드에서 2줄 안에 읽히는 짧은 완성 문장
- body에는 주제의 구체 정보(특징/사용 장면/비교 포인트/주의할 점 중 최소 1개)를 담으세요.
- "생활 속 선택", "중요한 기준", "반복되는 상황", "선택 이유", "더 오래 기억"처럼 어디에나 붙는 추상 문구를 쓰지 마세요.
- body는 반드시 완성된 문장으로 끝내세요. 조사, 명사, 연결어, 쉼표 뒤에서 절대 끊지 마세요.
- 전체 흐름은 관심 유도 → 이해/근거 → 핵심 가치 → 정리 또는 행동 촉구 순서로 이어져야 함
- save-cta 슬라이드: "저장", "확인", "체크", "비교" 중 하나의 행동을 반드시 포함
- 금지어·과장표현(혁신적인, 최고의, 완벽한) 사용 금지
- 모든 카피는 한국어로 작성

JSON 응답 형식:
{
  "slides": [
    { "slideNumber": 1, "headline": "...", "body": "..." }
  ]
}`
}

function getRole(n) {
  return ['hook', 'problem', 'detail', 'detail', 'save-cta'][n - 1] || 'unknown'
}

// ─── 단일 테스트 실행 ─────────────────────────────────────────────────
async function runTest(tc, failureLog) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`테스트 ${tc.id}/5 — ${tc.topic}`)
  if (failureLog.length > 0) {
    console.log(`  누적 실패 패턴 ${failureLog.length}건 프롬프트에 주입`)
  }
  console.log(`${'═'.repeat(60)}`)

  const prompt = buildPrompt(tc, failureLog)
  let slides = []

  try {
    const res = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.35,
      response_format: { type: 'json_object' },
    })
    const raw = res.choices[0]?.message?.content || '{}'
    slides = JSON.parse(raw)?.slides || []
  } catch (err) {
    console.error(`  ❌ API 실패: ${err.message}`)
    return null
  }

  if (!slides.length) {
    console.error('  ❌ 슬라이드 없음')
    return null
  }

  // 출력
  console.log('\n[생성된 카피]')
  for (const s of slides) {
    const hl = (s.headline || '')
    const body = (s.body || '')
    const hlLen = hl.length
    const bodyLen = body.length
    const hlFlag = hlLen > 20 ? ' 🔴' : ''
    const bodyFlag = bodyLen > 64 ? ' 🔴' : bodyLen < 42 ? ' 🟡' : ''
    console.log(`\n  슬라이드 ${s.slideNumber} [${getRole(s.slideNumber)}]`)
    console.log(`  제목(${hlLen}자)${hlFlag}: "${hl}"`)
    console.log(`  본문(${bodyLen}자)${bodyFlag}: "${body}"`)
  }

  const result = evaluate(slides, tc)
  console.log(`\n[품질 평가] ${result.score}/100`)
  if (result.issues.length) {
    console.log('  🔴 실패:')
    result.issues.forEach(i => console.log(`    [${i.type}] 슬라이드${i.slide ?? '전체'} — ${i.detail}`))
  }
  if (result.warnings.length) {
    console.log('  🟡 경고:')
    result.warnings.forEach(w => console.log(`    [${w.type}] 슬라이드${w.slide ?? '전체'} — ${w.detail}`))
  }
  if (!result.issues.length && !result.warnings.length) {
    console.log('  ✅ 문제 없음')
  }

  return { testId: tc.id, topic: tc.topic, slides, eval: result }
}

// ─── 실패 패턴 추출 ───────────────────────────────────────────────────
function extractFailurePatterns(testResult) {
  const patterns = []
  const { issues, warnings } = testResult.eval

  for (const issue of issues) {
    switch (issue.type) {
      case 'headline_too_long':
        patterns.push(`headline은 반드시 20자 이하. 위반 예시: ${issue.detail}`)
        break
      case 'body_too_long':
        patterns.push(`body는 반드시 64자 이하. 위반 예시: ${issue.detail}`)
        break
      case 'body_too_short':
        patterns.push(`body는 최소 42자 이상의 완성된 문장으로 작성. 위반 예시: ${issue.detail}`)
        break
      case 'body_incomplete_sentence':
        patterns.push(`body는 반드시 완성된 문장으로 종결. 위반 예시: ${issue.detail}`)
        break
      case 'banned_cliche':
        patterns.push(`금지 표현 사용 금지 — ${issue.detail}`)
        break
      case 'body_empty':
      case 'headline_empty':
        patterns.push(`슬라이드 ${issue.slide} body/headline이 비어있으면 안 됨`)
        break
    }
  }

  for (const warn of warnings) {
    switch (warn.type) {
      case 'abstract_filler':
        patterns.push(`추상적 채움 표현 금지 — ${warn.detail}`)
        break
      case 'cta_missing_action':
        patterns.push(`슬라이드 5(save-cta)에는 반드시 저장/확인/체크/비교 중 하나 포함`)
        break
      case 'word_overuse':
        patterns.push(`단어 과다 반복 금지 — ${warn.detail}`)
        break
      case 'slide_overlap':
        patterns.push(`슬라이드 간 같은 내용 반복 금지 — ${warn.detail}`)
        break
    }
  }

  return patterns
}

// ─── 메인 ─────────────────────────────────────────────────────────────
async function main() {
  console.log(`카드뉴스 카피 품질 순차 테스트 (5회, 실패 누적)`)
  console.log(`모델: ${MODEL}`)
  console.log(`시작 시각: ${new Date().toLocaleTimeString('ko-KR')}`)

  const allResults = []
  const accumulatedFailures = [] // 실패 패턴 누적 풀

  for (const tc of TEST_CASES) {
    const result = await runTest(tc, accumulatedFailures)
    if (!result) continue

    allResults.push(result)

    // 이번 테스트 실패 패턴 추출 후 다음 테스트에 누적
    const newPatterns = extractFailurePatterns(result)
    if (newPatterns.length > 0) {
      console.log(`\n  → 다음 테스트에 누적할 실패 패턴 ${newPatterns.length}건:`)
      newPatterns.forEach(p => console.log(`    • ${p}`))
      // 중복 제거 후 추가
      for (const p of newPatterns) {
        if (!accumulatedFailures.includes(p)) accumulatedFailures.push(p)
      }
    } else {
      console.log('\n  → 이번 테스트 실패 패턴 없음')
    }
  }

  // ─── 최종 종합 결과 ──────────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`)
  console.log('최종 종합 결과')
  console.log(`${'═'.repeat(60)}`)

  const scores = allResults.map(r => r.eval.score)
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

  for (const r of allResults) {
    const icon = r.eval.score >= 85 ? '✅' : r.eval.score >= 65 ? '🟡' : '🔴'
    console.log(`  ${icon} 테스트 ${r.testId} (${r.topic}): ${r.eval.score}점 | 실패 ${r.eval.issues.length}건 | 경고 ${r.eval.warnings.length}건`)
  }

  const totalIssues = allResults.reduce((a, r) => a + r.eval.issues.length, 0)
  const totalWarnings = allResults.reduce((a, r) => a + r.eval.warnings.length, 0)
  console.log(`\n  평균 점수: ${avg}/100 | 총 실패: ${totalIssues}건 | 총 경고: ${totalWarnings}건`)

  // ─── 실패 유형별 집계 ────────────────────────────────────────────
  const typeCounts = {}
  for (const r of allResults) {
    for (const i of r.eval.issues) {
      typeCounts[i.type] = (typeCounts[i.type] || 0) + 1
    }
    for (const w of r.eval.warnings) {
      typeCounts[w.type] = (typeCounts[w.type] || 0) + 1
    }
  }

  console.log('\n[실패/경고 유형 빈도]')
  const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) {
    console.log('  없음')
  } else {
    for (const [type, count] of sorted) {
      console.log(`  ${count}회 — ${type}`)
    }
  }

  // ─── 개선 흐름 분석 (1회→5회 점수 추이) ─────────────────────────
  if (allResults.length >= 2) {
    console.log('\n[누적 실패 주입 효과 — 라운드별 점수 추이]')
    allResults.forEach((r, i) => {
      const bar = '█'.repeat(Math.round(r.eval.score / 5))
      console.log(`  테스트 ${r.testId}: ${bar} ${r.eval.score}점`)
    })
    const first = allResults[0].eval.score
    const last = allResults[allResults.length - 1].eval.score
    const delta = last - first
    console.log(`  → 1회 대비 5회: ${delta >= 0 ? '+' : ''}${delta}점 (${delta >= 0 ? '개선' : '하락'})`)
  }

  // ─── 최종 누적 실패 패턴 목록 출력 ──────────────────────────────
  console.log('\n[5회 누적 실패 패턴 전체 목록]')
  if (accumulatedFailures.length === 0) {
    console.log('  없음 — 전 테스트 통과')
  } else {
    accumulatedFailures.forEach((p, i) => console.log(`  ${i + 1}. ${p}`))
  }

  // 분석 결과 반환 (개선 전략 단계에서 활용)
  return { avg, totalIssues, totalWarnings, typeCounts, allResults, accumulatedFailures }
}

main().then(summary => {
  if (summary) {
    // 다음 단계(개선 전략)를 위해 summary를 전역에 저장
    global.__testSummary = summary
  }
}).catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
