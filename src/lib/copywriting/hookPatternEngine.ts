import type { HookCandidate } from '../carousel/types'
import {
  getHookPatterns,
  type CopyKnowledgeContext,
  type HookPattern,
} from './copyKnowledgeBase'

export function buildHookPromptSection(ctx: CopyKnowledgeContext): string {
  const primary = ctx.selectedHookPatterns[0]
  if (!primary) return ''

  const bannedSample = ctx.resolvedBannedPhrases.slice(0, 4).join(', ')
  const personaTriggers = ctx.personaProfile.triggerWords.slice(0, 3).join('/')
  const lines = [
    `훅 패턴 가이드:`,
    `- 권장 패턴: ${primary.id} (템플릿: ${primary.templateKr})`,
    `- 감성 트리거: ${primary.emotionalTrigger} | 페르소나 반응어: ${personaTriggers}`,
    `- 추가 금지어: ${bannedSample}`,
  ]
  const result = lines.join('\n')
  return result.length > 220 ? result.slice(0, 217) + '...' : result
}

export function rankHooksByPattern(
  hooks: HookCandidate[],
  ctx: CopyKnowledgeContext
): HookCandidate[] {
  const patternMap = new Map(ctx.selectedHookPatterns.map((p, i) => [p.hookType, ctx.selectedHookPatterns.length - i]))

  return [...hooks]
    .map(hook => {
      const patternBonus = patternMap.get(hook.type) ?? 0
      const industryBonus = ctx.industryToneRule?.preferredPatterns
        ? ctx.selectedHookPatterns.some(p => ctx.industryToneRule!.preferredPatterns.includes(p.id) && p.hookType === hook.type)
          ? 3
          : 0
        : 0
      return { hook, adjustedScore: hook.score + patternBonus * 2 + industryBonus }
    })
    .sort((a, b) => b.adjustedScore - a.adjustedScore)
    .map(item => item.hook)
}

export function selectBestPatternForHook(hook: HookCandidate, ctx: CopyKnowledgeContext): HookPattern {
  const match = ctx.selectedHookPatterns.find(p => p.hookType === hook.type)
  if (match) return match
  const all = getHookPatterns()
  return all.find(p => p.hookType === hook.type) ?? ctx.selectedHookPatterns[0] ?? all[0]
}
