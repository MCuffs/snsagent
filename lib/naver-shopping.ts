/**
 * 네이버 쇼핑 검색 API
 * https://developers.naver.com/docs/serviceapi/search/shopping/shopping.md
 *
 * 스마트스토어 URL에서 shopId를 추출해 해당 스토어의 상품 목록을 가져옴
 */

export interface NaverProduct {
  title: string        // 상품명 (HTML 태그 포함될 수 있음)
  link: string         // 상품 상세 URL
  image: string        // 상품 이미지 URL
  lprice: string       // 최저가
  hprice: string       // 최고가 (없으면 빈 문자열)
  mallName: string     // 스토어명
  brand: string        // 브랜드
  maker: string        // 제조사
  category1: string    // 카테고리 대
  category2: string    // 카테고리 중
  category3: string    // 카테고리 소
}

export interface NaverShoppingResult {
  storeId: string
  storeName: string
  products: NaverProduct[]
  categories: string[]
  priceRange: { min: number; max: number }
}

/** HTML 태그 제거 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim()
}

/** URL에서 스마트스토어 shopId 추출 */
export function extractSmartStoreId(url: string): string | null {
  try {
    const match = url.match(/smartstore\.naver\.com\/([^/?#]+)/i)
    return match ? match[1].toLowerCase() : null
  } catch {
    return null
  }
}

/** 네이버 쇼핑 검색 API 호출 */
async function searchNaverShopping(
  clientId: string,
  clientSecret: string,
  query: string,
  display = 20
): Promise<NaverProduct[]> {
  const params = new URLSearchParams({
    query,
    display: String(display),
    sort: 'sim',
  })

  const res = await fetch(
    `https://openapi.naver.com/v1/search/shop.json?${params}`,
    {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
      signal: AbortSignal.timeout(10000),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`네이버 API 오류 ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json() as { items: NaverProduct[] }
  return data.items || []
}

/** 스마트스토어 상품 전체 수집 */
export async function fetchNaverStoreProducts(
  clientId: string,
  clientSecret: string,
  storeId: string
): Promise<NaverShoppingResult> {
  console.log(`[NaverAPI] 스마트스토어 "${storeId}" 상품 조회 중...`)

  // 1차: 스토어 ID로 검색 후 해당 스토어 상품만 필터
  const raw = await searchNaverShopping(clientId, clientSecret, storeId, 40)
  let products = raw.filter(p =>
    p.mallName?.toLowerCase().replace(/\s/g, '') === storeId.toLowerCase().replace(/\s/g, '') ||
    p.link?.includes(`smartstore.naver.com/${storeId}`) ||
    p.link?.includes(`/product/${storeId}`)
  )

  // 필터 후 너무 적으면 스토어명으로 재검색
  if (products.length < 3) {
    console.log(`[NaverAPI] 직접 필터 결과 부족(${products.length}개), 스토어명으로 재검색`)
    const storeName = raw[0]?.mallName || storeId
    const raw2 = await searchNaverShopping(clientId, clientSecret, `${storeName} ${storeId}`, 40)
    products = raw2.filter(p =>
      p.mallName?.toLowerCase().replace(/\s/g, '').includes(storeId.toLowerCase()) ||
      p.brand?.toLowerCase().includes(storeId.toLowerCase())
    )
    // 그래도 없으면 원본 전체 사용 (스토어명 동일한 것만)
    if (products.length < 2) {
      const nameFromFirst = raw.find(p => p.mallName)?.mallName || ''
      products = [...raw, ...raw2].filter(p => p.mallName === nameFromFirst).slice(0, 10)
    }
  }

  console.log(`[NaverAPI] 상품 ${products.length}개 수집 완료`)

  // 카테고리 집계
  const categories = [...new Set(
    products.flatMap(p => [p.category1, p.category2, p.category3].filter(Boolean))
  )].slice(0, 6)

  // 가격 범위
  const prices = products
    .map(p => parseInt(p.lprice || '0'))
    .filter(p => p > 0)
  const priceRange = {
    min: prices.length ? Math.min(...prices) : 0,
    max: prices.length ? Math.max(...prices) : 0,
  }

  const storeName = products[0]?.mallName || storeId

  return {
    storeId,
    storeName,
    products: products.map(p => ({ ...p, title: stripHtml(p.title) })).slice(0, 15),
    categories,
    priceRange,
  }
}

/** 분석용 텍스트 컨텍스트 생성 (Perplexity 프롬프트에 주입) */
export function buildStoreContext(result: NaverShoppingResult): string {
  const { storeName, products, categories, priceRange } = result

  const productLines = products
    .slice(0, 10)
    .map(p => {
      const price = p.lprice ? `${parseInt(p.lprice).toLocaleString()}원` : '가격 미정'
      return `- ${p.title} / ${price}${p.brand ? ` / 브랜드: ${p.brand}` : ''}`
    })
    .join('\n')

  const priceText = priceRange.max > 0
    ? `${priceRange.min.toLocaleString()}원 ~ ${priceRange.max.toLocaleString()}원`
    : '가격 정보 없음'

  return `
[네이버 스마트스토어 API 수집 데이터]
스토어명: ${storeName}
카테고리: ${categories.join(' > ')}
가격대: ${priceText}

[상품 목록 (총 ${products.length}개)]
${productLines}
`.trim()
}
