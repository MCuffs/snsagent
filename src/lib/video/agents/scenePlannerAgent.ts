/**
 * Scene Planner Agent
 *
 * First agent in the video card news pipeline.
 * Designs the narrative arc before any copy is written:
 *   - Decides each slide's role and emotional beat
 *   - Chooses a visual concept direction per scene
 *   - Sets the overall story structure (hook → build → resolve → CTA)
 *
 * Output feeds both Copy Agent (per-slide) and Prompt Engineer Agent (per-slide).
 */

import { getLightClient, getQwenModel } from '../../ai/llmClient'
import type { EditorialSlideRole } from '../../editorial/editorialDirector'

export interface ScenePlan {
  slideNumber: number
  role: EditorialSlideRole
  narrativeBeat: string      // what this scene must accomplish in the story
  emotionalTone: string      // how the viewer should feel watching this scene
  visualConcept: string      // brief visual direction (subject, motion quality)
  copyDirection: string      // what the headline/body copy must convey
}

export interface ScenePlannerInput {
  topic: string
  targetAndMessage?: string
  mood?: string
  objective?: string
  cta?: string
  mustInclude?: string
  avoid?: string
  slideCount: number
  domainLabel?: string
  brandTone?: string
  language: 'ko' | 'en'
  researchContext?: string
}

const ROLE_SEQUENCES: Record<number, EditorialSlideRole[]> = {
  3: ['hook', 'key-point', 'save-cta'],
  5: ['hook', 'context', 'key-point', 'detail', 'save-cta'],
  7: ['hook', 'context', 'key-point', 'detail', 'detail', 'summary', 'save-cta'],
}

function getRoleSequence(slideCount: number): EditorialSlideRole[] {
  return ROLE_SEQUENCES[slideCount]
    || ['hook', ...Array(Math.max(0, slideCount - 2)).fill('detail'), 'save-cta']
}

function buildFallbackPlan(input: ScenePlannerInput): ScenePlan[] {
  const roles = getRoleSequence(input.slideCount)
  const isKo = input.language === 'ko'
  return roles.map((role, i) => ({
    slideNumber: i + 1,
    role,
    narrativeBeat: isKo ? `${role} 역할 씬` : `${role} scene`,
    emotionalTone: isKo ? '명확하고 집중된' : 'clear and focused',
    visualConcept: isKo ? `주제 "${input.topic}" 관련 씬` : `scene related to "${input.topic}"`,
    copyDirection: isKo ? '핵심 메시지를 간결하게 전달' : 'deliver the core message concisely',
  }))
}

export async function runScenePlannerAgent(input: ScenePlannerInput): Promise<ScenePlan[]> {
  const client = getLightClient()
  const roles = getRoleSequence(input.slideCount)
  const isKo = input.language === 'ko'

  const researchBlock = input.researchContext
    ? (isKo
        ? `\n[참고 자료]\n${input.researchContext.slice(0, 800)}\n`
        : `\n[Reference]\n${input.researchContext.slice(0, 800)}\n`)
    : ''

  const briefFields = [
    input.targetAndMessage && (isKo ? `타겟/메시지: ${input.targetAndMessage}` : `Target/message: ${input.targetAndMessage}`),
    input.mood && (isKo ? `분위기: ${input.mood}` : `Mood: ${input.mood}`),
    input.objective && (isKo ? `목적: ${input.objective}` : `Objective: ${input.objective}`),
    input.cta && (isKo ? `CTA: ${input.cta}` : `CTA: ${input.cta}`),
    input.mustInclude && (isKo ? `반드시 포함: ${input.mustInclude}` : `Must include: ${input.mustInclude}`),
    input.avoid && (isKo ? `피해야 할 내용: ${input.avoid}` : `Avoid: ${input.avoid}`),
    input.brandTone && (isKo ? `브랜드 톤: ${input.brandTone}` : `Brand tone: ${input.brandTone}`),
  ].filter(Boolean).join('\n')

  const roleList = roles.map((r, i) => `슬라이드 ${i + 1}: ${r}`).join(', ')

  const prompt = isKo
    ? `당신은 숙련된 영상 카드뉴스 씬 플래너입니다.
주제: "${input.topic.slice(0, 600)}"
슬라이드 구성: ${roleList}
도메인: ${input.domainLabel ?? 'general'}
${briefFields}
${researchBlock}

각 슬라이드의 씬 계획을 설계합니다. 슬라이드 간 내러티브가 자연스럽게 이어지도록 하세요.
각 씬의 emotionalTone이 hook(긴장/호기심) → 중간(공감/이해) → save-cta(행동 유도)로 흘러가야 합니다.
visualConcept은 구체적인 시각 방향(피사체, 움직임, 분위기)을 영어로 작성합니다(영상 생성 모델에게 전달될 내용).
copyDirection은 해당 슬라이드의 카피가 전달해야 할 핵심 내용을 한국어로 명시합니다.

JSON만 반환:
{"scenes":[{"slideNumber":1,"role":"hook","narrativeBeat":"...","emotionalTone":"...","visualConcept":"...","copyDirection":"..."}]}`
    : `You are an expert video card news scene planner.
Topic: "${input.topic.slice(0, 600)}"
Slide structure: ${roleList}
Domain: ${input.domainLabel ?? 'general'}
${briefFields}
${researchBlock}

Design a scene plan for each slide so the narrative flows naturally from hook → build → resolve → CTA.
The emotionalTone should arc: hook (tension/curiosity) → middle (empathy/insight) → save-cta (invitation to act).
visualConcept must be a specific English cinematic direction (subject, motion, atmosphere) — it will be fed to a video generation model.
copyDirection states in plain English what the headline/body must communicate for that scene.

Return JSON only:
{"scenes":[{"slideNumber":1,"role":"hook","narrativeBeat":"...","emotionalTone":"...","visualConcept":"...","copyDirection":"..."}]}`

  const result = await client.generateJson<{ scenes: ScenePlan[] }>(
    'scene-planner-agent',
    prompt,
    () => ({ scenes: buildFallbackPlan(input) }),
    {
      model: getQwenModel(),
      temperature: 0.4,
      systemPrompt: isKo
        ? '영상 카드뉴스 씬 플래너입니다. JSON만 반환합니다.'
        : 'You are a video card news scene planner. Return JSON only.',
    },
  )

  const scenes = result?.scenes
  if (!Array.isArray(scenes) || scenes.length !== input.slideCount) {
    console.warn('[ScenePlannerAgent] Invalid scene count, using fallback')
    return buildFallbackPlan(input)
  }

  const validRoles = new Set(['hook', 'context', 'key-point', 'detail', 'stat', 'summary', 'save-cta'])
  return scenes.map((scene, i) => ({
    slideNumber: scene.slideNumber || i + 1,
    role: (validRoles.has(scene.role) ? scene.role : roles[i]) as EditorialSlideRole,
    narrativeBeat: String(scene.narrativeBeat || '').trim().slice(0, 200),
    emotionalTone: String(scene.emotionalTone || '').trim().slice(0, 150),
    visualConcept: String(scene.visualConcept || '').trim().slice(0, 500),
    copyDirection: String(scene.copyDirection || '').trim().slice(0, 300),
  }))
}
