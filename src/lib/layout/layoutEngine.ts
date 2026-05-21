import type { LayoutType } from './layoutTypes'

export interface LayoutSelectionInput {
  category: string
  topic: string
  tone: string
  contentType: string
}

export function selectLayout(input: LayoutSelectionInput): LayoutType {
  const text = `${input.category} ${input.topic} ${input.tone} ${input.contentType}`.toLowerCase()

  if (hasAny(text, ['세일', '할인', '이벤트', '특가', '혜택', '속보', '긴급', 'breaking'])) return 'breaking-news'
  if (hasAny(text, ['스토리', '브랜드', '가치', '소개', '철학', 'it', '테크'])) return 'dark-editorial'
  if (hasAny(text, ['트렌드', '커뮤니티', '반응', '요즘', 'viral'])) return 'trend-feed'
  if (hasAny(text, ['통계', '수치', '매출', '증가율', '베스트', '순위', 'top', '%', '데이터'])) return 'stat-highlight'
  if (hasAny(text, ['비교', 'vs', '차이', '장단점', '스펙'])) return 'split-comparison'
  if (hasAny(text, ['리뷰', '후기', '추천', '인용', '말', 'quote', '인터뷰'])) return 'quote-focus'
  if (hasAny(text, ['매거진', '라이프스타일', '프리미엄', '룩북', '패션', '뷰티'])) return 'magazine'
  if (hasAny(text, ['신상품', '런칭', '출시', '시네마틱', '영화'])) return 'cinematic-headline'
  if (hasAny(text, ['가이드', '체크리스트', '방법', '정리', '팁', '큐레이션', '정보'])) return 'minimal-clean'

  return input.contentType.includes('홍보') ? 'cinematic-headline' : 'minimal-clean'
}

function hasAny(text: string, keywords: string[]) {
  return keywords.some(keyword => text.includes(keyword))
}
