import type { LayoutType } from './layoutTypes'

export interface LayoutSelectionInput {
  category: string
  topic: string
  tone: string
  contentType: string
}

export function selectLayout(input: LayoutSelectionInput): LayoutType {
  const text = `${input.category} ${input.topic} ${input.tone} ${input.contentType}`.toLowerCase()

  if (hasAny(text, ['속보', '긴급', '이슈', '논란', '정치', '사회', '시장', '뉴스', 'breaking'])) {
    return 'breaking-news'
  }

  if (hasAny(text, ['통계', '수치', '데이터', '매출', '증가', '감소', '순위', 'top', '%', '배', '억', '만'])) {
    return 'stat-highlight'
  }

  if (hasAny(text, ['트렌드', '커뮤니티', '반응', '밈', 'viral', '요즘', '화제'])) {
    return 'trend-feed'
  }

  if (hasAny(text, ['비교', 'vs', '차이', '장단점', '선택'])) {
    return 'split-comparison'
  }

  if (hasAny(text, ['인용', '인터뷰', '발언', '말', 'quote'])) {
    return 'quote-focus'
  }

  if (hasAny(text, ['프리미엄', '매거진', '브랜드', '스토리', '철학', '패션', '뷰티'])) {
    return 'magazine'
  }

  if (hasAny(text, ['출시', '공개', '신제품', '발표', '캠페인', '홍보', '영상'])) {
    return 'cinematic-headline'
  }

  if (hasAny(text, ['가이드', '체크리스트', '방법', '정리', '큐레이션', '정보', '팁'])) {
    return 'dark-editorial'
  }

  return 'dark-editorial'
}

function hasAny(text: string, keywords: string[]) {
  return keywords.some(keyword => text.includes(keyword))
}
