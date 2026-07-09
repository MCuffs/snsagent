'use server'

import { dbService } from '../../lib/db-service'
import { checkBrandCountLimit } from '../../lib/limits'
import {
  getSessionUser,
  getErrorMessage,
  unauthenticated,
  failed,
  withBrandDna,
} from './_shared'

// Brand Save/Update Action
export async function saveBrandAction(brandId: string | null, data: {
  name: string
  industry: string
  targetAudience: string
  toneOfVoice: string
  mainColor: string
  forbiddenWords: string
  ctaStyle: string
  brandDna?: string | null
  websiteUrl?: string | null
}) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  const isGeneral = data.websiteUrl === 'general_profile'
  // Limit check for new brand creation
  if (!brandId) {
    const limitCheck = await checkBrandCountLimit(user.id, isGeneral)
    if (!limitCheck.allowed) {
      return failed(isGeneral
        ? '시사/정보/트렌드 프로필 생성 한도를 초과했습니다.'
        : `브랜드 생성 한도를 초과했습니다. 현재 요금제(${user.plan})의 브랜드 한도는 최대 ${limitCheck.limit}개입니다.`)
    }
  }

  try {
    let effectiveBrandId = brandId
    if (effectiveBrandId) {
      const existingBrand = await dbService.getBrand(effectiveBrandId)
      if (!existingBrand || existingBrand.userId !== user.id) {
        // Stale or foreign ID: update this user's existing brand of corresponding type if one exists.
        const brands = await dbService.getBrands(user.id)
        const fallbackBrand = brands.find(b =>
          isGeneral ? b.websiteUrl === 'general_profile' : b.websiteUrl !== 'general_profile'
        )
        effectiveBrandId = fallbackBrand?.id || null
      }
    }

    // Run the creation limit check after stale ID normalization.
    if (!effectiveBrandId) {
      const limitCheck = await checkBrandCountLimit(user.id, isGeneral)
      if (!limitCheck.allowed) {
        return failed(isGeneral
          ? '시사/정보/트렌드 프로필 생성 한도를 초과했습니다.'
          : `브랜드 생성 한도를 초과했습니다. 현재 요금제(${user.plan})의 브랜드 한도는 최대 ${limitCheck.limit}개입니다.`)
      }
    }

    const brand = await dbService.saveBrand(user.id, effectiveBrandId, data)
    return { success: true as const, brand }
  } catch (err: unknown) {
    return failed(getErrorMessage(err, '브랜드 저장에 실패했습니다.'))
  }
}

export async function getGenericWebsiteFallback(url: string, locale = 'ko') {
  let host = 'brand'
  try {
    host = new URL(url).hostname.replace(/^www\./, '').split('.')[0] || host
  } catch {
    host = url.replace(/^https?:\/\//, '').split(/[/?#.:]/)[0] || host
  }
  const displayName = host
    .split(/[-_]/)
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ') || (locale === 'en' ? 'Brand' : '브랜드')

  const isEn = locale === 'en'

  const brandProfile = {
    name: displayName,
    industry: isEn ? 'Online store' : '온라인 스토어',
    targetAudience: isEn
      ? 'Potential customers who compare and purchase products online'
      : '온라인에서 상품과 서비스를 비교하고 구매하는 잠재 고객',
    toneOfVoice: isEn ? 'Friendly and trustworthy' : '친근하고 신뢰감 있게',
    mainColor: '#1f1512',
    forbiddenWords: isEn
      ? 'guaranteed, 100% promise, best in industry, limited quantity hype'
      : '무조건, 100% 보장, 업계 최고, 한정 수량 과장',
    ctaStyle: isEn ? 'See details in store' : '스토어에서 자세히 보기',
  }

  const markdownReport = isEn
    ? `# Brand Analysis Draft

The website could not be scraped directly due to access restrictions, rate limits, or security policies. Shuffla generated this brand draft using its fallback analysis engine.

## 1. Basic Brand Profile
Brand: ${displayName}
Industry: Online store
Main color: #1f1512

## 2. Brand Direction
Target audience: Potential customers who compare and purchase products online
Tone of voice: Friendly and trustworthy

## 3. Card News Suggestions
Highlight key product features, usage scenarios, and customer benefits in a concise card news format.
Forbidden words: guaranteed, 100% promise, best in industry, limited quantity hype
CTA: See details in store
`
    : `# 브랜드 분석 및 구도 기획서

입력한 웹사이트가 일시적으로 접근 제한, 과도한 요청 제한, 보안 정책 등으로 직접 수집되지 않아 Shuffla의 대체 분석 엔진으로 브랜드 초안을 생성했습니다.

## 1. 브랜드 기본 프로필
브랜드명: ${displayName}
업종: 온라인 스토어
메인 컬러: #1f1512

## 2. 브랜드 방향
대상 고객: 온라인에서 상품과 서비스를 비교하고 구매하는 잠재 고객
톤앤매너: 친근하고 신뢰감 있게

## 3. 카드뉴스 운영 제안
상품의 핵심 특징, 사용 상황, 고객이 얻는 이점을 짧은 카드뉴스 구조로 정리하는 방향을 권장합니다.
금칙어: 무조건, 100% 보장, 업계 최고, 한정 수량 과장
CTA: 스토어에서 자세히 보기
`

  return { brandProfile: withBrandDna(brandProfile, url), markdownReport }
}

export async function getNaverSmartstoreFallback(shopId: string, url: string) {

  const isHu100 = shopId.toLowerCase() === 'hu100'

  if (isHu100) {
    const brandProfile = {
      name: '휴100 (hu100)',
      industry: '온라인 스토어' as const,
      targetAudience: '바쁜 일상 속 건강한 식습관과 친환경 웰빙 라이프스타일을 지향하는 3050 직장인 및 가족',
      toneOfVoice: '친근하고 명확한 톤' as const,
      mainColor: '#2F855A', // 편안한 오가닉 그린
      forbiddenWords: '만병통치약, 기적의 효과, 최저가, 100% 완치',
      ctaStyle: '오늘의 건강 혜택 프로필 링크에서 확인하기'
    }

    const markdownReport = `휴100은 건강한 식습관과 친환경 웰빙 라이프스타일을 추구하는 사람들을 위한 온라인 스토어입니다. '하루 100%의 휴식과 건강'이라는 메시지 아래, 바쁜 일상 속에서도 자연과 가까운 삶을 실천하고 싶은 3050 직장인과 가족을 주요 고객으로 합니다.

브랜드의 가장 큰 강점은 진정성입니다. 과장된 효능 주장 없이 성분과 생산 방식의 투명성으로 신뢰를 쌓고, 오가닉 그린 컬러톤으로 시각적 일관성을 유지합니다. 스마트스토어 특성상 리뷰 기반 소셜 프루프가 강하며, 구매 후기를 콘텐츠로 재가공하면 신뢰도와 전환율을 동시에 높일 수 있습니다.

카드뉴스는 '면역력을 지키는 생활 습관', '오가닉 제품 고르는 법' 같은 정보성 콘텐츠와 일상 힐링 감성을 교차 편성하는 것이 효과적입니다. "오늘의 건강 혜택 프로필 링크에서 확인하기" 같은 CTA로 마무리해 저압적으로 구매를 유도하는 것이 이 브랜드 톤과 잘 맞습니다.`
    return { brandProfile: withBrandDna(brandProfile, `${shopId} ${url}`), markdownReport }
  } else {
    const brandProfile = {
      name: `${shopId} 스토어`,
      industry: '온라인 스토어' as const,
      targetAudience: '스마트스토어를 애용하는 합리적이고 트렌디한 2040 모바일 쇼핑족',
      toneOfVoice: '친근하고 명확한 톤' as const,
      mainColor: '#03C75A',
      forbiddenWords: '최저가, 100% 보장, 광고, 실패없는',
      ctaStyle: '스토어에서 단독 혜택 만나보기'
    }

    const markdownReport = `${shopId} 스토어는 네이버 스마트스토어를 통해 운영되는 온라인 셀렉트샵으로, 모바일 쇼핑과 빠른 배송을 선호하는 2040 고객층을 주요 타겟으로 합니다. 직관적인 상세페이지 구성과 빠른 고객 응대가 경쟁력입니다.

SNS 카드뉴스는 실제 고객 리뷰와 사용 후기를 가공한 소셜 프루프 콘텐츠가 가장 효과적입니다. 상품의 핵심 특징을 3~5개 슬라이드로 간결하게 정리하고, 네이버 스토어 혜택(쿠폰, 포인트 적립)을 활용한 정기 이벤트 콘텐츠도 전환에 도움이 됩니다.

"스토어에서 단독 혜택 만나보기" CTA를 일관되게 사용해 브랜드 인지도와 클릭률을 함께 높이는 방향을 권장합니다.`
    return { brandProfile: withBrandDna(brandProfile, `${shopId} ${url}`), markdownReport }
  }
}
