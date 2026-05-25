// ─── 공통 fetch 헬퍼 ───────────────────────────────────────────────────────────

type PerplexityResponse = {
  choices: { message: { content: string } }[]
  error?: { message: string }
}

async function callPerplexity(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    }),
  })

  const data = await response.json() as PerplexityResponse
  if (data.error) throw new Error(`Perplexity 오류: ${data.error.message}`)
  return data.choices[0].message.content.trim()
}

function extractJson(text: string) {
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('Perplexity 응답에서 JSON을 찾을 수 없습니다.')
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    // 불완전한 JSON 복구: 마지막 완성된 필드까지만 파싱
    const partial = cleaned.slice(start, end + 1)
      .replace(/,\s*"[^"]*"\s*:\s*[^}]*$/, '') + '}'
    return JSON.parse(partial)
  }
}

// ─── 사이트맵에서 상품 URL 추출 ───────────────────────────────────────────────

async function fetchProductUrlsFromSitemap(baseUrl: string): Promise<string[]> {
  try {
    const origin = new URL(baseUrl).origin
    const sitemapUrl = `${origin}/sitemap.xml`
    console.log(`[Sitemap] 확인 중: ${sitemapUrl}`)

    const res = await fetch(sitemapUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []

    const xml = await res.text()

    // 상품 URL 패턴 추출 (카페24, 고도몰, 메이크샵 등 주요 쇼핑몰 형식)
    const productPatterns = [
      /https?:\/\/[^<\s]+\/product\/[^<\s"]+/g,  // 카페24: /product/상품명/번호/
      /https?:\/\/[^<\s]+\/goods\/[^<\s"]+/g,     // 고도몰: /goods/번호
      /https?:\/\/[^<\s]+\/item\/[^<\s"]+/g,      // 기타
    ]

    const urls: string[] = []
    for (const pattern of productPatterns) {
      const matches = xml.match(pattern) || []
      urls.push(...matches)
    }

    // 카테고리/목록 페이지 제외, 중복 제거, 최대 3개
    const filtered = [...new Set(urls)]
      .filter(u => !u.includes('/list') && !u.includes('/category'))
      .slice(0, 3)

    console.log(`[Sitemap] 상품 URL ${filtered.length}개 발견:`, filtered)
    return filtered
  } catch (e) {
    console.log('[Sitemap] 확인 실패:', e instanceof Error ? e.message : String(e))
    return []
  }
}

// ─── 1차: 브랜드 전체 분석 ────────────────────────────────────────────────────

const BRAND_ANALYSIS_PROMPT = (url: string) => `
다음 쇼핑몰 URL을 직접 방문해서 브랜드를 심층 분석해줘: ${url}

반드시 무시할 것 (포함하면 안 됨):
- 푸터(footer)의 저작권 문구, 회사 소개, 고객센터 안내
- 네비게이션 메뉴 텍스트
- 로그인/회원가입/장바구니 버튼
- "무단 복제 금지", "이용약관", "개인정보처리방침" 같은 법적 문구
- 쇼핑몰 솔루션 업체명(카페24, 메이크샵, 고도몰, Cafe24 등)
- "CLIENT SERVICES", "COMMUNITY", "CUSTOMER CENTER" 같은 사이트 운영 문구

분석할 것:
1. 브랜드명, 핵심 제품/서비스, 타깃 고객, 톤앤매너, 대표 브랜드 컬러(HEX)
2. 핵심 가치 제안 — 이 브랜드만의 구체적인 약속
3. 고객 페인포인트 — 실제 고객이 겪는 문제들
4. 경쟁 차별점 — 다른 브랜드와 구체적으로 다른 점
5. 브랜드 키워드 — 인스타 카드뉴스에 쓸 핵심 단어 10개
6. 금지 표현 — 이 업종에서 진부하거나 스팸성인 단어
7. CTA 스타일 — 이 브랜드 톤에 맞는 행동 유도 문구
8. 비주얼 무드 — 카드뉴스 이미지 방향성
9. SNS 콘텐츠 기둥 — 6가지 반복 주제

업종: 온라인 스토어, 카페 / F&B, 피트니스, 뷰티 / 케어, 교육 / 강의, IT / SaaS 중 하나
톤앤매너: 친근하고 명확한 톤, 전문적이고 신뢰감 있는 톤, 젊고 경쾌한 톤, 고급스럽고 차분한 톤 중 하나

반드시 유효한 JSON만 반환 (코드 펜스 없이, bold ** 절대 금지):
{
  "name": "브랜드명",
  "industry": "업종",
  "targetAudience": "타깃 고객 설명",
  "toneOfVoice": "톤앤매너",
  "mainColor": "#HEXCODE",
  "forbiddenWords": "금지어1, 금지어2",
  "ctaStyle": "CTA 추천",
  "coreProducts": ["핵심 제품/서비스"],
  "valueProposition": "핵심 가치 제안",
  "customerPainPoints": ["고객 페인포인트"],
  "differentiators": ["차별점"],
  "visualMood": "비주얼 무드",
  "contentPillars": ["SNS 콘텐츠 기둥 6가지"],
  "brandKeywords": ["브랜드 키워드 10개"],
  "avoidVisuals": ["피해야 할 비주얼"],
  "markdownReport": "# 브랜드 분석 보고서\\n\\n## 1. 브랜드 정체성\\n..."
}
`

// ─── 2차-A: 사이트맵으로 찾은 상품 상세페이지 분석 ──────────────────────────

const PRODUCT_DETAIL_PROMPT = (urls: string[], brandName: string) => `
다음 "${brandName}" 쇼핑몰의 상품 상세페이지들을 직접 방문해서 분석해줘:
${urls.map((u, i) => `${i + 1}. ${u}`).join('\n')}

반드시 무시: 푸터, 저작권, 네비, 로그인, 쇼핑몰 솔루션 텍스트

분석할 것:
- 각 상품의 정식 상품명, 가격, 핵심 설명
- 소재/스펙/구성 (있으면)
- 상세페이지에서 강조하는 판매 포인트 (브랜드의 실제 표현 그대로)
- 이 상품이 어울리는 사용자/상황 (타깃 시나리오)
- 후기/리뷰에서 자주 나오는 키워드 (있으면)
- 가격 포지셔닝: 프리미엄 / 중간 / 합리적
- 인스타그램 카드뉴스에 바로 쓸 수 있는 카피 아이디어 5개

반드시 유효한 JSON만 반환:
{
  "products": [
    {
      "name": "상품명",
      "price": "가격",
      "description": "핵심 설명",
      "specs": "소재/스펙",
      "sellingPoints": ["판매 포인트"],
      "usageScenarios": ["사용 시나리오"],
      "reviewKeywords": ["후기 키워드"]
    }
  ],
  "pricePositioning": "프리미엄/중간/합리적",
  "commonSellingStyle": "공통 판매 스타일",
  "copyIdeas": ["카드뉴스 카피 아이디어 5개"]
}
`

// ─── 2차-B: 웹 검색으로 상품/브랜드 리뷰 수집 (사이트맵 실패 폴백) ───────────

const WEB_SEARCH_PROMPT = (brandName: string, url: string) => `
"${brandName}" 브랜드를 웹 검색해서 상품 정보와 고객 반응을 수집해줘.
브랜드 웹사이트: ${url}

검색 방향:
- "${brandName} 리뷰", "${brandName} 후기", "${brandName} 상품"
- 네이버 블로그, 인스타그램, 유튜브 등 외부 소스 참고
- 실제 구매자들이 언급하는 장점/단점/사용 경험

수집할 것:
- 대표 상품명과 가격대 (검색에서 확인된 것들)
- 고객들이 실제로 쓰는 표현과 후기 키워드
- 자주 언급되는 판매 포인트
- 가격 포지셔닝
- 이 브랜드 제품을 사는 사람들의 실제 구매 동기
- 인스타그램 카드뉴스에 바로 쓸 수 있는 카피 아이디어 5개

반드시 유효한 JSON만 반환:
{
  "products": [
    {
      "name": "상품명",
      "price": "가격대",
      "description": "설명",
      "specs": "",
      "sellingPoints": ["판매 포인트"],
      "usageScenarios": ["사용 시나리오"],
      "reviewKeywords": ["실제 후기 키워드"]
    }
  ],
  "pricePositioning": "프리미엄/중간/합리적",
  "commonSellingStyle": "공통 판매 스타일",
  "copyIdeas": ["카드뉴스 카피 아이디어 5개"]
}
`

// ─── 결과 병합 ────────────────────────────────────────────────────────────────

function buildProductMarkdownSection(
  products: Array<Record<string, unknown>>,
  productResult: Record<string, unknown>
): string {
  const lines: string[] = ['\n\n## 상품별 분석']

  for (const p of products) {
    lines.push(`\n### ${p.name || '상품'}`)
    if (p.price) lines.push(`- 가격: ${p.price}`)
    if (p.description) lines.push(`- 설명: ${p.description}`)
    if (p.specs) lines.push(`- 소재/스펙: ${p.specs}`)
    const sp = (p.sellingPoints as string[] | undefined) || []
    if (sp.length > 0) {
      lines.push('- 판매 포인트:')
      sp.forEach(s => lines.push(`  - ${s}`))
    }
    const rk = (p.reviewKeywords as string[] | undefined) || []
    if (rk.length > 0) lines.push(`- 후기 키워드: ${rk.join(', ')}`)
    const us = (p.usageScenarios as string[] | undefined) || []
    if (us.length > 0) lines.push(`- 사용 시나리오: ${us.join(' / ')}`)
  }

  if (productResult.pricePositioning) lines.push(`\n가격 포지셔닝: ${productResult.pricePositioning}`)
  if (productResult.commonSellingStyle) lines.push(`공통 판매 스타일: ${productResult.commonSellingStyle}`)

  const copyIdeas = (productResult.copyIdeas as string[] | undefined) || []
  if (copyIdeas.length > 0) {
    lines.push('\n## 카드뉴스 카피 아이디어')
    copyIdeas.forEach((idea, i) => lines.push(`${i + 1}. ${idea}`))
  }

  return lines.join('\n')
}

function mergeAnalysis(
  brandResult: Record<string, unknown>,
  productResult: Record<string, unknown> | null
) {
  // 노이즈 필터
  const NOISE = ['CLIENT SERVICES COMPANY', 'COMMUNITY CUSTOMER CENT', 'product', 'COMMUNITY']
  const cleanList = (arr: unknown[]) =>
    (arr as string[]).filter(item => !NOISE.some(n => item.includes(n)))

  const cleanBrand = {
    ...brandResult,
    coreProducts: cleanList(brandResult.coreProducts as unknown[] || []),
    differentiators: cleanList(brandResult.differentiators as unknown[] || []),
  }

  if (!productResult) return cleanBrand

  const products = (productResult.products as Array<Record<string, unknown>>) || []

  // 상품명을 coreProducts 앞에 추가
  const productNames = products.map(p => p.name as string).filter(Boolean)
  const mergedProducts = [...new Set([...productNames, ...cleanBrand.coreProducts as string[]])].slice(0, 6)

  // 판매 포인트를 differentiators에 보강
  const extraPoints = products.flatMap(p => (p.sellingPoints as string[] || [])).slice(0, 2)
  const mergedDiff = [...new Set([...(cleanBrand.differentiators as string[]), ...extraPoints])].slice(0, 6)

  // markdownReport에 상품 분석 섹션 추가
  const baseReport = String(brandResult.markdownReport || '')
  const productSection = buildProductMarkdownSection(products, productResult)

  return {
    ...cleanBrand,
    coreProducts: mergedProducts,
    differentiators: mergedDiff,
    markdownReport: baseReport + productSection,
    productDetail: {
      products,
      pricePositioning: productResult.pricePositioning,
      commonSellingStyle: productResult.commonSellingStyle,
      copyIdeas: productResult.copyIdeas,
    },
  }
}

// ─── 스마트스토어 전용: 네이버 API 데이터 기반 분석 ──────────────────────────

const SMARTSTORE_ANALYSIS_PROMPT = (storeContext: string, storeId: string) => `
다음은 네이버 쇼핑 API로 수집한 "${storeId}" 스마트스토어의 실제 상품 데이터야.
이 데이터를 기반으로 브랜드를 심층 분석해줘.

${storeContext}

추가로 웹에서 "${storeId}" 브랜드를 검색해서 다음 정보도 보완해줘:
- 브랜드 스토리, 창업 배경, 핵심 철학
- 실제 고객 후기에서 자주 나오는 키워드
- 인스타그램/블로그에서 언급되는 브랜드 이미지

반드시 무시: 네이버 UI, 네이버페이, 찜하기, 플랫폼 공통 메뉴

분석:
1. 브랜드명, 핵심 제품/서비스, 타깃 고객, 톤앤매너, 대표 브랜드 컬러(HEX)
2. 핵심 가치 제안 — 구체적으로
3. 고객 페인포인트 5개 이상 — 실제 문제 중심으로
4. 경쟁 차별점 5개 이상 — 브랜드 고유 표현으로
5. 브랜드 키워드 10개
6. 금지 표현, CTA 스타일, 비주얼 무드, SNS 콘텐츠 기둥 6가지
7. 상품별 카드뉴스 카피 아이디어 5개

업종: 온라인 스토어, 카페 / F&B, 피트니스, 뷰티 / 케어, 교육 / 강의, IT / SaaS 중 하나
톤앤매너: 친근하고 명확한 톤, 전문적이고 신뢰감 있는 톤, 젊고 경쾌한 톤, 고급스럽고 차분한 톤 중 하나

반드시 유효한 JSON만 반환 (코드 펜스 없이, bold ** 절대 금지):
{
  "name": "브랜드명",
  "industry": "업종",
  "targetAudience": "타깃 고객",
  "toneOfVoice": "톤앤매너",
  "mainColor": "#HEXCODE",
  "forbiddenWords": "금지어1, 금지어2",
  "ctaStyle": "CTA 추천",
  "coreProducts": ["핵심 제품 — 실제 상품명 포함"],
  "valueProposition": "핵심 가치 제안",
  "customerPainPoints": ["고객 페인포인트"],
  "differentiators": ["차별점"],
  "visualMood": "비주얼 무드",
  "contentPillars": ["SNS 콘텐츠 기둥 6가지"],
  "brandKeywords": ["브랜드 키워드 10개"],
  "avoidVisuals": ["피해야 할 비주얼"],
  "copyIdeas": ["카드뉴스 카피 아이디어 5개"],
  "markdownReport": "# 브랜드 분석 보고서\\n\\n## 1. 브랜드 정체성\\n..."
}
`

// ─── 메인 export ──────────────────────────────────────────────────────────────

const SYSTEM = 'You are a brand analysis expert for Korean e-commerce. Return valid JSON only. No code fences. No bold markdown (**). Ignore footer, copyright, navigation, login buttons, and shopping mall platform text (Cafe24, Makeshop, etc).'

export async function analyzeNaverStoreWithPerplexity(
  apiKey: string,
  storeId: string,
  storeContext: string  // fetchNaverStoreProducts → buildStoreContext 결과
) {
  console.log(`[Perplexity] 스마트스토어 "${storeId}" 분석 시작 (네이버 API 데이터 활용)`)

  // 1차: 네이버 API 상품 데이터 기반 브랜드 분석
  const brandRaw = await callPerplexity(apiKey, SYSTEM, SMARTSTORE_ANALYSIS_PROMPT(storeContext, storeId))
  const brandResult = extractJson(brandRaw)
  console.log('[Perplexity] 스마트스토어 1차 분석 완료:', brandResult.name)

  // 2차: 웹 검색으로 리뷰·블로그·SNS 기반 상품 심층 분석
  let productResult: Record<string, unknown> | null = null
  try {
    console.log(`[Perplexity] 스마트스토어 2차 — 웹 검색으로 리뷰/SNS 분석`)
    const raw = await callPerplexity(apiKey, SYSTEM, WEB_SEARCH_PROMPT(String(brandResult.name || storeId), `https://smartstore.naver.com/${storeId}`))
    productResult = extractJson(raw)
    console.log('[Perplexity] 스마트스토어 2차 완료')
  } catch (e) {
    console.warn('[Perplexity] 스마트스토어 2차 실패 (1차 결과만 사용):', e)
  }

  // 노이즈 필터 + 병합
  return mergeAnalysis(brandResult, productResult)
}

export async function analyzeBrandWithPerplexity(apiKey: string, url: string) {
  // 1차: 브랜드 전체 분석
  console.log('[Perplexity] 1차 — 브랜드 분석 시작')
  const brandRaw = await callPerplexity(apiKey, SYSTEM, BRAND_ANALYSIS_PROMPT(url))
  const brandResult = extractJson(brandRaw)
  console.log('[Perplexity] 1차 완료:', brandResult.name)

  // 2차: 상품 상세 분석
  // Step 1 — 사이트맵에서 상품 URL 시도
  const sitemapUrls = await fetchProductUrlsFromSitemap(url)

  let productResult: Record<string, unknown> | null = null

  if (sitemapUrls.length > 0) {
    // 사이트맵 성공 → 실제 상품 상세페이지 분석
    console.log(`[Perplexity] 2차-A — 사이트맵 상품 ${sitemapUrls.length}개 분석`)
    try {
      const raw = await callPerplexity(apiKey, SYSTEM, PRODUCT_DETAIL_PROMPT(sitemapUrls, String(brandResult.name || '')))
      productResult = extractJson(raw)
      console.log('[Perplexity] 2차-A 완료')
    } catch (e) {
      console.warn('[Perplexity] 2차-A 실패, 웹검색으로 폴백:', e)
    }
  }

  if (!productResult) {
    // 사이트맵 없거나 실패 → 웹 검색으로 폴백
    console.log('[Perplexity] 2차-B — 웹 검색으로 상품/리뷰 수집')
    try {
      const raw = await callPerplexity(apiKey, SYSTEM, WEB_SEARCH_PROMPT(String(brandResult.name || ''), url))
      productResult = extractJson(raw)
      console.log('[Perplexity] 2차-B 완료')
    } catch (e) {
      console.warn('[Perplexity] 2차-B 실패 (1차 결과만 사용):', e)
    }
  }

  return mergeAnalysis(brandResult, productResult)
}
