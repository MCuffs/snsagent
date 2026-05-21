import type { LayoutType } from './layoutTypes'

export interface LayoutSelectionInput {
  category: string
  topic: string
  tone: string
  contentType: string
}

export function selectLayout(input: LayoutSelectionInput): LayoutType {
  const text = `${input.category} ${input.topic} ${input.tone} ${input.contentType}`.toLowerCase()

  if (hasAny(text, ['정치', '속보', '긴급', '논란', '이슈', 'breaking'])) return 'breaking-news'
  if (hasAny(text, ['ai 뉴스', '인공지능', '테크', '빅테크', '엔비디아', '오픈ai'])) return 'dark-editorial'
  if (hasAny(text, ['트렌드', '커뮤니티', '밈', '반응', '요즘', 'viral'])) return 'trend-feed'
  if (hasAny(text, ['통계', '수치', '실적', '매출', '증가율', '%', '데이터'])) return 'stat-highlight'
  if (hasAny(text, ['비교', 'vs', '차이', '장단점'])) return 'split-comparison'
  if (hasAny(text, ['인용', '말', 'quote', '인터뷰', '한마디'])) return 'quote-focus'
  if (hasAny(text, ['매거진', '브랜드', '라이프스타일', '프리미엄'])) return 'magazine'
  if (hasAny(text, ['영화', '시네마틱', '드라마틱', '헤드라인'])) return 'cinematic-headline'
  if (hasAny(text, ['정보', '가이드', '체크리스트', '방법', '정리'])) return 'minimal-clean'

  return input.contentType.includes('뉴스') ? 'dark-editorial' : 'minimal-clean'
}

function hasAny(text: string, keywords: string[]) {
  return keywords.some(keyword => text.includes(keyword))
}
