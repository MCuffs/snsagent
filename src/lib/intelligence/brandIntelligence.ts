/**
 * Brand Intelligence Compression Engine
 *
 * Reads accumulated QualityScoreLogs + userEditLogs for a brand,
 * derives what actually worked vs. what users kept editing away,
 * and writes a compressed SummarizedPreference that the next
 * generation pipeline reads directly into its prompts.
 *
 * Called fire-and-forget after every successful carousel generation.
 * Also called by the billing cron to keep preferences fresh.
 */

import { PrismaClient } from '@prisma/client'
import { getLLMClient, getLightClient, getCopywritingModel, getQwenModel } from '../ai/llmClient'
import type { HookPatternId } from '../copywriting/copyKnowledgeBase'

const prisma = new PrismaClient()

// Minimum logs needed before we attempt compression
const MIN_QUALITY_LOGS = 2

interface BrandSignals {
  brandId: string
  userId: string
  // Hook patterns that had high scores
  winningHookPatterns: { id: string; avgScore: number; count: number }[]
  // Hook patterns that scored poorly
  losingHookPatterns: { id: string; avgScore: number; count: number }[]
  // Persona that had best fit scores
  bestPersona: { id: string; avgScore: number } | null
  // How often user edits after generation (lower = better result)
  avgEditsPerCampaign: number
  // Recent headlines user typed themselves (signals preferred style)
  recentUserEdits: { before: number; after: number; eventType: string }[]
  // Industry
  industryUsed: string | null
  totalCampaigns: number
}

interface CompressionResult {
  summary: string
  preferredHookPatterns: string   // JSON: top 3 HookPatternId[]
  avoidPatterns: string           // JSON: bottom patterns HookPatternId[]
  preferredCopyTone: string
  preferredLayouts: string | null
  editLogCountAtCompress: number
}

export async function runBrandIntelligenceCompression(
  brandId: string,
  userId: string,
): Promise<void> {
  try {
    // 1. Gather raw signals
    const signals = await collectBrandSignals(brandId, userId)

    // Not enough data yet — don't overwrite with noise
    if (signals.totalCampaigns < MIN_QUALITY_LOGS) return

    // 2. Derive structured preferences from signals
    const compression = await compressSignals(signals)

    // 3. Persist
    await prisma.summarizedPreference.upsert({
      where: { brandId },
      update: {
        summary: compression.summary,
        preferredHookPatterns: compression.preferredHookPatterns,
        avoidPatterns: compression.avoidPatterns,
        preferredCopyTone: compression.preferredCopyTone,
        preferredLayouts: compression.preferredLayouts,
        editLogCountAtCompress: compression.editLogCountAtCompress,
        compressedAt: new Date(),
      },
      create: {
        userId,
        brandId,
        summary: compression.summary,
        preferredHookPatterns: compression.preferredHookPatterns,
        avoidPatterns: compression.avoidPatterns,
        preferredCopyTone: compression.preferredCopyTone,
        preferredLayouts: compression.preferredLayouts,
        editLogCountAtCompress: compression.editLogCountAtCompress,
      },
    })
  } catch (err) {
    // Fire-and-forget — never throws to caller
    console.warn('[BrandIntelligence] compression failed silently', err)
  }
}

async function collectBrandSignals(brandId: string, userId: string): Promise<BrandSignals> {
  const [qualityLogs, editLogs, campaigns] = await Promise.all([
    prisma.qualityScoreLog.findMany({
      where: { userId, campaign: { brandId } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        score: true,
        hookPatternScore: true,
        personaFitScore: true,
        hookPatternUsed: true,
        personaUsed: true,
        industryUsed: true,
      },
    }),
    prisma.userEditLog.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        eventType: true,
        editDelta: true,
      },
    }),
    prisma.campaign.count({ where: { brandId } }),
  ])

  // Aggregate hook pattern performance
  const hookMap = new Map<string, { totalScore: number; count: number }>()
  for (const log of qualityLogs) {
    if (!log.hookPatternUsed) continue
    const existing = hookMap.get(log.hookPatternUsed) ?? { totalScore: 0, count: 0 }
    hookMap.set(log.hookPatternUsed, {
      totalScore: existing.totalScore + log.score,
      count: existing.count + 1,
    })
  }

  const hookRanking = Array.from(hookMap.entries())
    .map(([id, { totalScore, count }]) => ({ id, avgScore: totalScore / count, count }))
    .sort((a, b) => b.avgScore - a.avgScore)

  // Aggregate persona performance
  const personaMap = new Map<string, { totalScore: number; count: number }>()
  for (const log of qualityLogs) {
    if (!log.personaUsed) continue
    const existing = personaMap.get(log.personaUsed) ?? { totalScore: 0, count: 0 }
    personaMap.set(log.personaUsed, {
      totalScore: existing.totalScore + log.personaFitScore,
      count: existing.count + 1,
    })
  }
  const bestPersonaEntry = Array.from(personaMap.entries())
    .map(([id, { totalScore, count }]) => ({ id, avgScore: totalScore / count }))
    .sort((a, b) => b.avgScore - a.avgScore)[0]

  // Parse edit deltas
  const recentUserEdits = editLogs.flatMap(log => {
    if (!log.editDelta) return []
    try {
      const delta = JSON.parse(log.editDelta) as { beforeLength: number; afterLength: number }
      return [{ before: delta.beforeLength, after: delta.afterLength, eventType: log.eventType }]
    } catch { return [] }
  })

  const avgEditsPerCampaign = campaigns > 0 ? editLogs.length / campaigns : 0
  const industryUsed = qualityLogs.find(l => l.industryUsed)?.industryUsed ?? null

  return {
    brandId,
    userId,
    winningHookPatterns: hookRanking.slice(0, 3),
    losingHookPatterns: hookRanking.slice(-2).filter(h => h.avgScore < 60),
    bestPersona: bestPersonaEntry ?? null,
    avgEditsPerCampaign,
    recentUserEdits,
    industryUsed,
    totalCampaigns: campaigns,
  }
}

async function compressSignals(signals: BrandSignals): Promise<CompressionResult> {
  const editLogCount = signals.recentUserEdits.length

  // Derive copy tone from edit patterns
  const preferredCopyTone = deriveCopyTone(signals)

  // Hook patterns
  const preferredHookPatterns = JSON.stringify(
    signals.winningHookPatterns.map(h => h.id as HookPatternId)
  )
  const avoidPatterns = JSON.stringify(
    signals.losingHookPatterns.map(h => h.id as HookPatternId)
  )

  // Use LLM only for the human-readable summary — everything else is deterministic
  const summary = await generateSummary(signals, preferredCopyTone)

  return {
    summary,
    preferredHookPatterns,
    avoidPatterns,
    preferredCopyTone,
    preferredLayouts: null, // populated by layout performance tracking (future)
    editLogCountAtCompress: editLogCount,
  }
}

function deriveCopyTone(signals: BrandSignals): string {
  const { recentUserEdits, avgEditsPerCampaign } = signals

  // If user frequently shortens copy (after < before), they prefer punchy
  const shortenings = recentUserEdits.filter(e =>
    e.eventType === 'headline_edit' && e.after < e.before * 0.8
  ).length

  // If user rarely edits (< 2 edits/campaign), AI output is being accepted as-is
  const lowEditRate = avgEditsPerCampaign < 2

  if (shortenings > recentUserEdits.length * 0.4) return 'short_punchy'
  if (lowEditRate) return 'informational' // AI default is working — keep it
  if (signals.bestPersona?.id === 'lifestyle_aspirant') return 'emotional'
  if (signals.bestPersona?.id === 'informed_professional') return 'informational'
  return 'balanced'
}

async function generateSummary(signals: BrandSignals, derivedTone: string): Promise<string> {
  // If no meaningful signals yet, return empty — better than a noisy summary
  if (signals.winningHookPatterns.length === 0 && signals.recentUserEdits.length < 5) {
    return ''
  }

  const prompt = `브랜드의 카드뉴스 생성 이력에서 다음 신호를 분석했습니다.

성과 좋은 훅 패턴: ${signals.winningHookPatterns.map(h => `${h.id}(평균점수 ${Math.round(h.avgScore)})`).join(', ') || '없음'}
피해야 할 훅 패턴: ${signals.losingHookPatterns.map(h => h.id).join(', ') || '없음'}
가장 잘 맞는 독자 페르소나: ${signals.bestPersona?.id || '미정'}
캠페인당 평균 편집 횟수: ${signals.avgEditsPerCampaign.toFixed(1)}회
업종: ${signals.industryUsed || '미정'}
도출된 카피 톤: ${derivedTone}

위 신호를 바탕으로, 이 브랜드의 카드뉴스 카피 방향에 대한 핵심 인사이트를 100자 이내 한국어로 작성하세요.
다음 생성에서 AI 카피라이터가 참고할 수 있도록, 구체적이고 실행 가능하게 작성하세요.
예: "훅에서 비교 반전 구조가 가장 높은 점수. 감성 호소보다 정보 제공형이 잘 수용됨. 헤드라인은 15자 내외로 유지."
JSON 없이 순수 텍스트만 응답하세요.`

  try {
    const client = getLightClient()
    const result = await client.generateJson<{ summary: string }>(
      'brand-intelligence-summary',
      prompt + '\n\n{"summary": "<100자 이내 인사이트>"}',
      () => ({ summary: '' }),
      { model: getQwenModel(), temperature: 0.3 }
    )
    const text = result?.summary?.trim() ?? ''
    return text.slice(0, 200) // hard cap
  } catch {
    return ''
  }
}

