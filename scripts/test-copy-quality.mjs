/**
 * 카드뉴스 제목/본문 품질 테스트 스크립트
 * 5가지 다른 주제로 카피 생성 후 품질 분석
 */

import OpenAI from 'openai'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// .env 파일 수동 파싱
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
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = val
    }
  } catch {}
}

loadEnv(resolve(process.cwd(), '.env'))
loadEnv(resolve(process.cwd(), '.env.local'))

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || undefined
const MODEL = process.env.OPENAI_COPY_MODEL || process.env.OPENAI_TEXT_MODEL || 'gpt-4o'

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found')
  process.exit(1)
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  ...(OPENAI_BASE_URL ? { baseURL: OPENAI_BASE_URL } : {}),
})

// 5가지 테스트 케이스 (각기 다른 주제/카테고리)
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
    keyContent: `한국의 연간 음식물 쓰레기는 약 500만 톤으로 처리 비용만 8천억 원에 달한다. 밀랍 랩 사용으로 플라스틱 랩 사용을 90% 줄일 수 있다. 텀블러 사용 시 연간 플라스틱 컵 500개를 절약한다. 장 볼 때 에코백 사용, 재사용 용기 활용, 음식 낭비 줄이기가 제로 웨이스트 주방의 핵심이다. 작은 실천이 환경에 큰 차이를 만든다.`,
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

const SYSTEM_PROMPT = `당신은 한국 인스타그램 정보/시사/트렌드 카드뉴스 전문 에디터입니다. 제공된 기사/사실 자료를 객관적이고 가독성 높게 요약하여 카드뉴스 카피를 작성하세요. 브랜드 이름이나 브랜드 DNA를 노출하지 말고 오직 뉴스/정보 전달에만 집중하세요. 유효한 JSON으로만 응답하세요.`

function buildTestPrompt(tc) {
  const slides = [
    { slideNumber: 1, role: 'hook', purpose: '독자 시선을 즉시 잡는 훅' },
    { slideNumber: 2, role: 'problem', purpose: '문제/현상 제시' },
    { slideNumber: 3, role: 'detail', purpose: '핵심 근거/사실 전달' },
    { slideNumber: 4, role: 'detail', purpose: '실용적 해결책 또는 추가 인사이트' },
    { slideNumber: 5, role: 'save-cta', purpose: '핵심 요약 + 행동 촉구' },
  ]
  const slideDesc = slides.map(s => `슬라이드 ${s.slideNumber} [${s.role}]: ${s.purpose}`).join('\n')

  return `한국 인스타그램 카드뉴스 카피를 작성해주세요.

브랜드 정보:
- 브랜드명: 일반 정보/뉴스 전달용
- 업종: 시사/정보/트렌드
- 톤앤매너: ${tc.tone}
- 금지어: 없음

콘텐츠 기획:
- 주제: ${tc.topic}
- 캠페인 목표: ${tc.objective}
- 콘텐츠 유형: ${tc.contentType}
- 카테고리: ${tc.category}

제공된 사실 및 기획 자료:
${tc.keyContent}

슬라이드 구성:
${slideDesc}

규칙:
- headline: 20자 이하, 강렬하고 구체적 (공백 포함)
- body: 42~64자, 최대 2문장, 모바일 카드에서 2줄 안에 읽히는 짧은 완성 문장
- body에는 주제의 구체 정보(특징/사용 장면/비교 포인트/주의할 점 중 최소 1개)를 담으세요.
- "생활 속 선택", "중요한 기준", "반복되는 상황", "선택 이유", "더 오래 기억"처럼 어디에나 붙는 추상 문구를 쓰지 마세요.
- body는 반드시 완성된 문장으로 끝내세요. 조사, 명사, 연결어, 쉼표 뒤에서 절대 끊지 마세요.
- body는 하나의 구체 기준 또는 행동만 담고, 긴 설명은 다음 슬라이드로 넘기세요.
- 전체 흐름은 관심 유도 → 이해/근거 → 핵심 가치 → 정리 또는 행동 촉구 순서로 이어져야 함
- 각 슬라이드는 앞뒤와 자연스럽게 연결되어야 함
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

function evaluateCopy(slides, tc) {
  const issues = []
  const warnings = []
  let score = 100

  for (const slide of slides) {
    const hl = slide.headline || ''
    const body = slide.body || ''

    // 1. headline 길이 체크 (20자 이하)
    if (hl.length > 20) {
      issues.push(`슬라이드 ${slide.slideNumber}: headline "${hl}" 이 20자 초과 (${hl.length}자)`)
      score -= 10
    }

    // 2. body 길이 체크 (42~64자)
    if (body.length < 30) {
      issues.push(`슬라이드 ${slide.slideNumber}: body 너무 짧음 (${body.length}자) — "${body}"`)
      score -= 15
    } else if (body.length < 42) {
      warnings.push(`슬라이드 ${slide.slideNumber}: body 권장 길이 미달 (${body.length}자/권장 42자+) — "${body}"`)
      score -= 5
    } else if (body.length > 80) {
      issues.push(`슬라이드 ${slide.slideNumber}: body 너무 김 (${body.length}자/최대 64자) — "${body}"`)
      score -= 10
    }

    // 3. body 문장 완성 체크
    const lastChar = body.slice(-1)
    if ([',', '과', '와', '은', '는', '이', '가', '을', '를', '의', '에', '로', '으로', '(', '·'].includes(lastChar)) {
      issues.push(`슬라이드 ${slide.slideNumber}: body가 불완전하게 끊김 — 마지막 문자: "${lastChar}"`)
      score -= 15
    }

    // 4. 금지 클리셰 체크
    const cliches = ['혁신적인', '최고의', '완벽한', '생활 속 선택', '중요한 기준', '반복되는 상황', '선택 이유', '더 오래 기억']
    for (const c of cliches) {
      if (hl.includes(c) || body.includes(c)) {
        issues.push(`슬라이드 ${slide.slideNumber}: 금지 표현 "${c}" 사용`)
        score -= 8
      }
    }

    // 5. headline 비어있는지
    if (!hl.trim()) {
      issues.push(`슬라이드 ${slide.slideNumber}: headline 비어있음`)
      score -= 20
    }

    // 6. body 비어있는지
    if (!body.trim()) {
      issues.push(`슬라이드 ${slide.slideNumber}: body 비어있음`)
      score -= 20
    }

    // 7. 내부 기획 토큰 유출
    const leakTokens = ['STORY ONTOLOGY', 'guiding question', 'visualDirection', 'imagePurpose', 'daily use scene']
    for (const tok of leakTokens) {
      if (hl.includes(tok) || body.includes(tok)) {
        issues.push(`슬라이드 ${slide.slideNumber}: 내부 기획 토큰 유출 — "${tok}"`)
        score -= 20
      }
    }
  }

  // 8. save-cta 슬라이드에 행동 촉구어 있는지
  const ctaSlide = slides.find(s => s.slideNumber === 5)
  if (ctaSlide) {
    const ctaWords = ['저장', '확인', '체크', '비교']
    const hasCta = ctaWords.some(w => ctaSlide.headline.includes(w) || ctaSlide.body.includes(w))
    if (!hasCta) {
      warnings.push(`슬라이드 5 (save-cta): 행동 촉구어(저장/확인/체크/비교) 없음`)
      score -= 5
    }
  }

  // 9. 슬라이드 간 서사 연결 체크 — 간단히 중복 문구 감지
  const bodies = slides.map(s => s.body || '')
  for (let i = 1; i < bodies.length; i++) {
    const prev = bodies[i - 1]
    const curr = bodies[i]
    if (prev && curr && prev.length > 10 && curr.length > 10) {
      const prevWords = new Set(prev.split(/\s+/).filter(w => w.length > 2))
      const currWords = curr.split(/\s+/).filter(w => w.length > 2)
      const overlap = currWords.filter(w => prevWords.has(w))
      if (overlap.length >= 4) {
        warnings.push(`슬라이드 ${i + 1}: 이전 슬라이드와 내용 중복 가능성 — 중복 단어: ${overlap.slice(0, 5).join(', ')}`)
        score -= 3
      }
    }
  }

  return { score: Math.max(0, score), issues, warnings }
}

async function runTest(tc) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`테스트 ${tc.id}: ${tc.topic}`)
  console.log(`${'='.repeat(60)}`)

  const prompt = buildTestPrompt(tc)

  let result
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
    result = JSON.parse(raw)
  } catch (err) {
    console.error(`  ❌ API 호출 실패:`, err.message)
    return null
  }

  const slides = result?.slides || []
  if (!slides.length) {
    console.error('  ❌ 슬라이드 생성 실패 — 빈 응답')
    return null
  }

  console.log('\n[생성된 카피]')
  for (const s of slides) {
    console.log(`\n  슬라이드 ${s.slideNumber} [${getRole(s.slideNumber)}]`)
    console.log(`  제목: "${s.headline}" (${(s.headline || '').length}자)`)
    console.log(`  본문: "${s.body}" (${(s.body || '').length}자)`)
  }

  const eval_ = evaluateCopy(slides, tc)
  console.log(`\n[품질 평가] 점수: ${eval_.score}/100`)
  if (eval_.issues.length) {
    console.log('  🔴 문제:')
    eval_.issues.forEach(i => console.log(`    - ${i}`))
  }
  if (eval_.warnings.length) {
    console.log('  🟡 경고:')
    eval_.warnings.forEach(w => console.log(`    - ${w}`))
  }
  if (!eval_.issues.length && !eval_.warnings.length) {
    console.log('  ✅ 문제 없음')
  }

  return { testId: tc.id, topic: tc.topic, slides, eval: eval_ }
}

function getRole(slideNumber) {
  return ['hook', 'problem', 'detail', 'detail', 'save-cta'][slideNumber - 1] || 'unknown'
}

async function main() {
  console.log(`카드뉴스 카피 품질 테스트`)
  console.log(`모델: ${MODEL}`)
  console.log(`API Base: ${OPENAI_BASE_URL || 'https://api.openai.com'}`)
  console.log(`테스트 케이스: ${TEST_CASES.length}개`)

  const results = []
  for (const tc of TEST_CASES) {
    const r = await runTest(tc)
    if (r) results.push(r)
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log('종합 결과 요약')
  console.log(`${'='.repeat(60)}`)

  const scores = results.map(r => r.eval.score)
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
  const totalIssues = results.reduce((a, r) => a + r.eval.issues.length, 0)
  const totalWarnings = results.reduce((a, r) => a + r.eval.warnings.length, 0)

  for (const r of results) {
    const icon = r.eval.score >= 80 ? '✅' : r.eval.score >= 60 ? '🟡' : '🔴'
    console.log(`  ${icon} 테스트 ${r.testId} (${r.topic}): ${r.eval.score}점, 문제 ${r.eval.issues.length}개, 경고 ${r.eval.warnings.length}개`)
  }

  console.log(`\n  평균 점수: ${avg}/100`)
  console.log(`  총 문제: ${totalIssues}건, 총 경고: ${totalWarnings}건`)

  if (avg < 70) {
    console.log('\n  ⚠️  전반적인 품질 개선 필요')
  } else if (avg < 85) {
    console.log('\n  ℹ️  일부 개선 필요')
  } else {
    console.log('\n  ✅ 전반적으로 양호')
  }

  // 반복 패턴 분석
  console.log('\n[반복 패턴 분석]')
  const allHeadlines = results.flatMap(r => r.slides.map(s => s.headline || ''))
  const allBodies = results.flatMap(r => r.slides.map(s => s.body || ''))
  const abstractPhrases = ['생활 속', '중요한', '선택', '기준', '이유', '시작']
  for (const phrase of abstractPhrases) {
    const count = [...allHeadlines, ...allBodies].filter(t => t.includes(phrase)).length
    if (count >= 3) {
      console.log(`  🔄 "${phrase}" — ${count}번 등장 (추상적 반복 패턴 의심)`)
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
