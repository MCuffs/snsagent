import type { ShortsTemplateConfig } from './types'

export type HookDesign = ShortsTemplateConfig['hookDesign']

export const HOOK_PRESETS: Record<HookDesign['preset'], Partial<HookDesign>> = {
  breaking_news: {
    fontFamily: 'Pretendard Black',
    fontSize: 92,
    fontWeight: 900,
    lineHeight: 1.08,
    letterSpacing: -4,
    textColor: '#FFFFFF',
    emphasisColor: '#16E0E8',
    backgroundType: 'gradient',
    backgroundColor: '#071127',
    backgroundGradientStart: '#071127',
    backgroundGradientEnd: '#101D3C',
    quoteEnabled: true,
  },
  drama_archive: {
    fontFamily: 'Pretendard ExtraBold',
    fontSize: 78,
    fontWeight: 800,
    lineHeight: 1.12,
    letterSpacing: -2,
    textColor: '#111111',
    emphasisColor: '#E32620',
    backgroundType: 'solid',
    backgroundColor: '#FFFFFF',
    profileHeaderEnabled: true,
  },
  knowledge_bold: {
    fontFamily: 'Pretendard Black',
    fontSize: 94,
    fontWeight: 900,
    lineHeight: 1.04,
    letterSpacing: -5,
    textColor: '#080808',
    emphasisColor: '#080808',
    backgroundType: 'solid',
    backgroundColor: '#FFFFFF',
  },
  entertainment_feed: {
    fontFamily: 'Pretendard ExtraBold',
    fontSize: 78,
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: -3,
    textColor: '#080808',
    emphasisColor: '#080808',
    backgroundType: 'solid',
    backgroundColor: '#FFFFFF',
    profileHeaderEnabled: true,
  },
  anime_editorial: {
    fontFamily: 'Pretendard ExtraBold',
    fontSize: 72,
    fontWeight: 800,
    lineHeight: 1.18,
    letterSpacing: -2,
    textColor: '#080808',
    emphasisColor: '#080808',
    backgroundType: 'solid',
    backgroundColor: '#FFFFFF',
    profileHeaderEnabled: true,
  },
}

export function applyHookPreset(current: HookDesign, preset: HookDesign['preset']): HookDesign {
  return { ...current, ...HOOK_PRESETS[preset], preset }
}
