'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Loader2, AlertCircle, Send, Clapperboard, ImagePlus, X, Check, Clock, Sparkles, Film, ArrowRight, RotateCcw, Square, Link2, Rows3 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Brand {
  id: string
  name: string
  industry: string
  targetAudience: string
  toneOfVoice: string
  mainColor?: string
}

interface VideoSlide {
  slideNumber: number
  headline: string
  body: string
  role: string
  videoUrl: string | null
  videoStartSec?: number
  durationSeconds: number
  error?: string | null
}

interface SlideProgress {
  slideNumber: number
  status: 'waiting' | 'generating' | 'done' | 'error'
  elapsed?: number
  error?: string
}

interface VideoCardNewsFormProps {
  brand: Brand
  hasApiKey?: boolean
}

interface UserChatMessage {
  id: string
  content: string
  images?: string[]
}

interface DraftVideoSlide {
  slideNumber: number
  role: string
  headline: string
  body: string
}

interface VideoPlanSlide extends DraftVideoSlide {
  videoPrompt: string
}

interface AiChatMessage {
  id: string
  type: 'clarify' | 'confirm' | 'progress' | 'result' | 'error' | 'cancelled'
  text?: string
  confirmInfo?: CollectedInfo
  stageLabel?: string
  slideProgress?: SlideProgress[]
  draftSlides?: DraftVideoSlide[]
  referenceImagePreviews?: string[]
  slides?: VideoSlide[]
  errorText?: string
  partialFailures?: number
  clarification?: ClarificationPrompt
}

interface ClarificationOption {
  label: string
  value: string
}

interface ClarificationPrompt {
  question: string
  options: ClarificationOption[]
  allowCustom?: boolean
  skipLabel?: string
}

// ── 대화형 흐름 상태 ──────────────────────────────────────────────

type ChatPhase = 'idle' | 'clarifying' | 'confirming' | 'generating' | 'done'
type VideoContinuityMode = 'separate' | 'continuous'

interface CollectedInfo {
  rawTopic: string
  targetAndMessage?: string  // 1차 답변 전체 (타겟 + 핵심 메시지)
  mood?: string              // 2차 답변 (분위기)
  objective?: string          // 제작 목적
  cta?: string                // 마지막 행동 유도
  mustInclude?: string        // 반드시 포함할 정보
  avoid?: string              // 피해야 할 정보/표현
  sceneDirections?: string[]  // 사용자가 명시한 카드별 영상 장면 지시
  videoContinuityMode?: VideoContinuityMode // 장면 연결 방식
  refinedTopic: string       // API에 전송할 최종 topic
  videoPlan?: VideoPlanSlide[]
}

function buildRefinedTopic(info: Omit<CollectedInfo, 'refinedTopic'>): string {
  const parts = [info.rawTopic]
  if (info.targetAndMessage) parts.push(`독자와 메시지: ${info.targetAndMessage}`)
  if (info.mood) parts.push(`분위기: ${info.mood}`)
  if (info.objective) parts.push(`제작 목적: ${info.objective}`)
  if (info.cta) parts.push(`CTA: ${info.cta}`)
  if (info.mustInclude) parts.push(`반드시 포함: ${info.mustInclude}`)
  if (info.avoid) parts.push(`피해야 할 내용: ${info.avoid}`)
  return parts.join('\n')
}

// 각 단계별 사용자 친화적 안내 문구
const STAGE_LABELS: Record<string, string> = {
  copy_thinking: '✦ AI가 슬라이드 구성을 기획하고 있습니다...',
  copy_done_prefix: '✓ 카피 기획 완료 — ',
  video_start: '◎ 영상 생성을 시작합니다. 슬라이드당 약 1~2분 소요됩니다.',
  saving: '↑ 캠페인을 저장하고 있습니다...',
  redirect: '→ 편집 화면으로 이동합니다...',
}

const smoothEase = { duration: 0.72, ease: [0.19, 1, 0.22, 1] as const }
const fadeIn = {
  initial: { opacity: 0, y: 14, scale: 0.985, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -8, scale: 0.99 },
}

function getVideoRoleSequence(slideCount: number) {
  const roleSequences: Record<number, string[]> = {
    3: ['hook', 'key-point', 'save-cta'],
    5: ['hook', 'context', 'key-point', 'detail', 'save-cta'],
    7: ['hook', 'context', 'key-point', 'detail', 'detail', 'summary', 'save-cta'],
  }
  return roleSequences[slideCount] || ['hook', ...Array(Math.max(0, slideCount - 2)).fill('detail'), 'save-cta']
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    hook: '첫 장면',
    context: '문제 상황',
    'key-point': '핵심 장면',
    detail: '설명 장면',
    summary: '정리 장면',
    'save-cta': '마무리 장면',
  }
  return labels[role] || '장면'
}

function parseExplicitSceneBrief(text: string) {
  const markers = Array.from(text.matchAll(/(?:^|\n)\s*(?:영상|장면|씬|scene|slide)\s*(\d+)\s*[.:：]\s*/gi))
  if (markers.length === 0) return null

  const scenes = markers
    .map((match, index) => {
      const start = (match.index ?? 0) + match[0].length
      const end = index + 1 < markers.length ? markers[index + 1].index ?? text.length : text.length
      return {
        number: Number(match[1]),
        text: text.slice(start, end).trim(),
      }
    })
    .filter(scene => scene.number > 0 && scene.text.length > 0)
    .sort((a, b) => a.number - b.number)

  if (scenes.length === 0) return null
  const firstMarkerIndex = markers[0].index ?? 0
  const brief = text.slice(0, firstMarkerIndex).trim()
  return { brief, scenes }
}

function getSceneDirectionsFromMessages(messages: Array<{ role: 'user' | 'assistant'; content: string }>) {
  const userText = messages
    .filter(message => message.role === 'user')
    .map(message => message.content)
    .join('\n')
  return parseExplicitSceneBrief(userText)?.scenes.map(scene => scene.text) ?? undefined
}

function isShufflaPromotion(text: string) {
  return /shuffla|셔플라/i.test(text)
}

function buildEditableVideoPlan(
  info: Pick<CollectedInfo, 'rawTopic' | 'targetAndMessage' | 'mood' | 'objective' | 'cta' | 'mustInclude' | 'avoid' | 'sceneDirections'>,
  slideCount: number,
  brand: Brand,
): VideoPlanSlide[] {
  const roles = getVideoRoleSequence(slideCount)
  const sceneBrief = parseExplicitSceneBrief(info.rawTopic)
  const cleanTopic = (sceneBrief?.brief || info.rawTopic).trim()
  const sourceTopic = info.rawTopic.trim()
  const audience = info.targetAndMessage?.trim() || `${brand.targetAudience || '핵심 고객'}에게 메시지를 명확하게 전달`
  const mood = info.mood?.trim() || `${brand.toneOfVoice || '깔끔하고 신뢰감 있는'} 톤`
  const objective = info.objective?.trim() || '핵심 메시지를 이해시키고 다음 행동을 유도'
  const cta = info.cta?.trim() || '더 알아보기'
  const mustInclude = info.mustInclude?.trim() || ''
  const avoid = info.avoid?.trim() || '근거 없는 수치와 과장 표현'
  const requestedBrandText = extractRequestedBrandText(`${cleanTopic} ${audience} ${mood} ${objective} ${cta} ${mustInclude}`)
  const sceneDirections = info.sceneDirections?.length ? info.sceneDirections : sceneBrief?.scenes.map(scene => scene.text)
  const shufflaPromotion = isShufflaPromotion(sourceTopic)

  return roles.map((role, index) => {
    const slideNumber = index + 1
    const label = roleLabel(role)
    const headline = buildDraftHeadline(role, cleanTopic, slideNumber, requestedBrandText, shufflaPromotion)
    const body = buildDraftBody(role, cleanTopic, audience, requestedBrandText, cta, mustInclude, shufflaPromotion)
    const previousRole = roles[index - 1]
    const nextRole = roles[index + 1]
    return {
      slideNumber,
      role,
      headline,
      body,
      videoPrompt: buildSceneVideoPrompt({
        slideNumber,
        role,
        label,
        topic: cleanTopic,
        headline,
        audience,
        mood,
        objective,
        cta,
        mustInclude,
        avoid,
        explicitSceneDirection: sceneDirections?.[index] ?? '',
        brandName: brand.name,
        requestedBrandText,
        totalSlides: roles.length,
        previousLabel: previousRole ? roleLabel(previousRole) : null,
        nextLabel: nextRole ? roleLabel(nextRole) : null,
      }),
    }
  })
}

function extractRequestedBrandText(text: string) {
  const urlMatch = text.match(/\b[a-z0-9-]+\.(?:io|com|co\.kr|kr|net|ai)\b/i)
  if (urlMatch) return normalizeBrandText(urlMatch[0])
  return ''
}

function normalizeBrandText(text: string) {
  if (/^shuffla\.io$/i.test(text)) return 'Shuffla.io'
  return text
}

function buildDraftHeadline(role: string, topic: string, slideNumber: number, requestedBrandText = '', shufflaPromotion = false) {
  if (shufflaPromotion) {
    if (role === 'hook') return '상상이 시작되는 순간'
    if (role === 'key-point') return '장면이 튀어나오다'
    if (role === 'save-cta') return 'Shuffla.io'
    if (role === 'context') return '평범한 순간의 반전'
    if (role === 'summary') return '아이디어를 영상으로'
  }
  if (requestedBrandText) {
    if (role === 'hook') return `${requestedBrandText}의 핵심 가치`
    if (role === 'key-point') return `더 쉽게 전달하는 방법`
    if (role === 'save-cta') return `지금 바로 시작`
  }
  if (role === 'hook') return topic.length > 18 ? topic.slice(0, 18).trimEnd() : topic
  if (role === 'context') return '왜 지금 중요할까'
  if (role === 'key-point') return '핵심은 더 쉽게'
  if (role === 'summary') return '한 번에 정리'
  if (role === 'save-cta') return '지금 바로 시작'
  return `포인트 ${slideNumber}`
}

function buildDraftBody(role: string, topic: string, audience: string, requestedBrandText = '', cta = '더 알아보기', mustInclude = '', shufflaPromotion = false) {
  if (shufflaPromotion) {
    if (role === 'hook') return '평범한 거리 위로 상상력이 들어오는 첫 장면을 엽니다.'
    if (role === 'key-point') return '카드 속 세계가 현실로 확장되며 Shuffla의 제작 감각을 각인시킵니다.'
    if (role === 'save-cta') return '아이디어를 영상 카드뉴스로 바꾸는 시작점을 Shuffla.io로 남깁니다.'
    if (role === 'context') return '일상적인 장면과 판타지 전환을 대비시켜 시선을 붙잡습니다.'
    if (role === 'summary') return '상상한 장면을 하나의 브랜드 티저 흐름으로 정리합니다.'
  }
  if (requestedBrandText) {
    if (role === 'hook') return `${requestedBrandText}가 제공하는 핵심 가치를 첫 장에서 명확하게 제시합니다.`
    if (role === 'key-point') return `${audience}에게 필요한 흐름을 짧고 이해하기 쉬운 메시지로 정리합니다.`
    if (role === 'save-cta') return `${cta} 행동을 자연스럽게 떠올릴 수 있도록 마무리합니다.`
  }
  if (role === 'hook') return `${topic}의 핵심 가치를 첫 화면에서 바로 이해할 수 있게 전달합니다.`
  if (role === 'context') return `${audience} 관점에서 지금 이 메시지가 필요한 이유를 짚어줍니다.`
  if (role === 'key-point') return mustInclude ? `${mustInclude}를 중심으로 핵심 정보를 짧고 명확하게 정리합니다.` : `복잡한 내용을 짧고 명확한 흐름으로 정리해 이해를 돕습니다.`
  if (role === 'summary') return `앞선 메시지를 하나의 결론으로 묶어 기억하기 쉽게 정리합니다.`
  if (role === 'save-cta') return `${cta} 행동을 떠올릴 수 있도록 차분하게 마무리합니다.`
  return `${topic}에 대한 구체적인 장점을 쉬운 문장으로 보강합니다.`
}

function buildSceneVideoPrompt(params: {
  slideNumber: number
  role: string
  label: string
  topic: string
  headline: string
  audience: string
  mood: string
  objective: string
  cta: string
  mustInclude: string
  avoid: string
  explicitSceneDirection: string
  brandName: string
  requestedBrandText: string
  totalSlides: number
  previousLabel: string | null
  nextLabel: string | null
}) {
  const scene = buildSceneDirection(params)
  const textRule = 'No readable text, no subtitles, no UI labels, no logo, no watermark. Any brand name, URL, headline, or CTA will be added later as a clean card overlay outside the generated video.'
  const continuity = buildEditableContinuityDirection(params)

  return [
    'Wide 16:9 cinematic video for the upper media panel of a vertical card news layout.',
    `Scene ${params.slideNumber} of ${params.totalSlides} (${params.label}) in one continuous sequence.`,
    continuity,
    scene,
    `Topic: ${params.topic}. Objective: ${params.objective}. Message: ${params.audience}. Mood: ${params.mood}. CTA overlay intent: ${params.cta}. Must include in card copy only: ${params.mustInclude || 'none'}. Avoid: ${params.avoid}. Brand context: ${params.brandName}.`,
    textRule,
    'Keep the same subject identity or object family, same location family, same lighting, same color grade, same lens feel, and same premium composition across all scenes. Keep the main subject centered with generous headroom and side margins. Natural subtle motion, realistic office lighting, clean premium composition. Do not reset into an unrelated stock scene.',
  ].join(' ')
}

function buildEditableContinuityDirection(params: {
  slideNumber: number
  totalSlides: number
  label: string
  previousLabel: string | null
  nextLabel: string | null
}) {
  const intro = params.slideNumber === 1
    ? 'This opening scene establishes the visual world, main subject, location, lighting, and camera direction for the entire sequence.'
    : `This scene continues directly from scene ${params.slideNumber - 1}${params.previousLabel ? ` (${params.previousLabel})` : ''}; begin with the same visual world, subject, location, lighting, and camera direction already established.`
  const outro = params.slideNumber < params.totalSlides
    ? `End with a natural visual cue that leads into scene ${params.slideNumber + 1}${params.nextLabel ? ` (${params.nextLabel})` : ''}.`
    : 'End as the resolved final beat of the same sequence, not as a separate commercial shot.'

  return `${intro} Current beat: ${params.label}. ${outro} Camera continuity should feel like the next cut in one short film, using subtle match-cut logic and no abrupt visual reset.`
}

function buildSceneDirection(params: {
  role: string
  headline: string
  requestedBrandText: string
  explicitSceneDirection: string
}) {
  if (params.explicitSceneDirection.trim()) {
    return [
      `Primary user scene direction: "${params.explicitSceneDirection.trim()}".`,
      'Use this as the main visual action for this card, translating it into cinematic motion and composition.',
      'Do not copy this direction into subtitles, captions, UI labels, or card body text.',
      'If it asks for readable text, reserve that text for the app overlay and keep the generated video itself free of readable text.',
    ].join(' ')
  }

  const brandText = params.requestedBrandText
  if (brandText) {
    if (params.role === 'hook') {
      return `Opening shot: a person works at a computer in a calm office setting, similar to the reference image if provided. The monitor is visible but all on-screen content is abstract and unreadable. Camera makes a slow natural push-in.`
    }
    if (params.role === 'key-point') {
      return `Middle shot: over-the-shoulder view of the same person using the computer. The interface appears clean and premium, but every screen element remains abstract and unreadable while the posture suggests active work.`
    }
    if (params.role === 'save-cta') {
      return `Final shot: the camera smoothly settles on the workspace as the task feels complete. The screen stays visually clean with no readable words, leaving room for the app overlay text.`
    }
  }
  return `Scene intent: visually express "${params.headline}" through cinematic action and environment, not through written text.`
}

export default function VideoCardNewsForm({ brand }: VideoCardNewsFormProps) {
  const router = useRouter()
  const locale = useLocale()
  const isEn = locale === 'en'
  const [topic, setTopic] = useState('')
  const [userMessages, setUserMessages] = useState<UserChatMessage[]>([])
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>([])
  const [attachedImages, setAttachedImages] = useState<Array<{ file: File; preview: string }>>([])
  const [isDragging, setIsDragging] = useState(false)
  const [slideCount, setSlideCount] = useState<3 | 5 | 7>(5)
  const [generating, setGenerating] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  // 대화형 흐름 상태
  const [phase, setPhase] = useState<ChatPhase>('idle')
  const [collectedInfo, setCollectedInfo] = useState<Partial<CollectedInfo>>({})
  const [isWaiting, setIsWaiting] = useState(false)
  const [isStartingGeneration, setIsStartingGeneration] = useState(false)

  const chatBottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const activeMsgIdRef = useRef<string | null>(null)
  const referenceImagesRef = useRef<Array<{ file: File; preview: string }>>([])
  const generationAbortRef = useRef<AbortController | null>(null)
  const pingAbortRef = useRef<AbortController | null>(null)
  const stopRequestedRef = useRef(false)
  const startingGenerationRef = useRef(false)

  const addImages = useCallback((files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    const newImages = imageFiles.slice(0, 3 - attachedImages.length).map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }))
    setAttachedImages(prev => [...prev, ...newImages].slice(0, 3))
  }, [attachedImages.length])

  const removeImage = (index: number) => {
    setAttachedImages(prev => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? [])
      const imageFiles = items
        .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
        .map(item => item.getAsFile())
        .filter(Boolean) as File[]
      if (imageFiles.length > 0) addImages(imageFiles)
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [addImages])

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    addImages(e.dataTransfer.files)
  }

  useEffect(() => {
    if (userMessages.length === 0 && aiMessages.length === 0) return
    const timer = window.setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [aiMessages, generating, userMessages])

  const updateActiveMsg = (updater: (msg: AiChatMessage) => AiChatMessage) => {
    const id = activeMsgIdRef.current
    if (!id) return
    setAiMessages(prev => prev.map(m => m.id === id ? updater(m) : m))
  }

  const runGenerate = async (info: CollectedInfo, existingMsgId?: string) => {
    const currentImages = referenceImagesRef.current
    setPhase('generating')
    setGenerating(true)
    stopRequestedRef.current = false
    const msgId = existingMsgId ?? `ai-gen-${Date.now()}`
    activeMsgIdRef.current = msgId
    flushSync(() => {
      setAiMessages(prev => [...prev, {
        id: msgId,
        type: 'progress',
        stageLabel: currentImages.length > 0
          ? `참고 이미지 ${currentImages.length}개를 업로드하고 있습니다...`
          : STAGE_LABELS.copy_thinking,
        slideProgress: [],
        referenceImagePreviews: currentImages.map(image => image.preview),
      }])
    })
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setTopic('')
    setAttachedImages([])

    const controller = new AbortController()
    generationAbortRef.current = controller
    const timeoutId = setTimeout(() => controller.abort(), 8 * 60 * 1000)

    try {
      let referenceImageUrls: string[] = []
      if (currentImages.length > 0) {
        const formData = new FormData()
        currentImages.forEach(image => formData.append('files', image.file))
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData, signal: controller.signal })
        const uploadData = await uploadRes.json() as { urls?: string[]; error?: string }
        if (!uploadRes.ok || !uploadData.urls?.length) {
          updateActiveMsg(m => ({
            ...m,
            type: 'error',
            errorText: uploadData.error || '참고 이미지를 업로드하지 못했습니다.',
          }))
          return
        }
        referenceImageUrls = uploadData.urls.slice(0, 3)
        updateActiveMsg(m => ({
          ...m,
          stageLabel: `참고 이미지 ${referenceImageUrls.length}개를 반영해 장면과 카피를 기획하고 있습니다...`,
        }))
      }

      const res = await fetch('/api/video-cardnews/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          topic: info.rawTopic,
          targetAndMessage: info.targetAndMessage,
          mood: info.mood,
          objective: info.objective,
          cta: info.cta,
          mustInclude: info.mustInclude,
          avoid: info.avoid,
          brandId: brand.id,
          slideCount,
          durationSeconds: 5,
          videoContinuityMode: info.videoContinuityMode ?? 'separate',
          domainLabel: brand.industry,
          brandTone: brand.toneOfVoice,
          language: isEn ? 'en' : 'ko',
          referenceImageUrls,
          plannedSlides: info.videoPlan,
        }),
      })
      clearTimeout(timeoutId)

      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('text/event-stream')) {
        const text = await res.text()
        let errMsg = '서버 오류가 발생했습니다.'
        try {
          const data = JSON.parse(text) as { error?: string }
          if (data.error) errMsg = data.error
        } catch { /* ignore */ }
        updateActiveMsg(m => ({ ...m, type: 'error', errorText: errMsg }))
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const processEvent = (eventName: string, rawData: string) => {
        let data: Record<string, unknown>
        try { data = JSON.parse(rawData) } catch { return }

        if (eventName === 'stage') {
          const stage = data.stage as string
          if (stage === 'research') {
            updateActiveMsg(m => ({ ...m, stageLabel: '✦ 최신 뉴스와 트렌드를 수집하는 중...' }))
          } else if (stage === 'saving') {
            updateActiveMsg(m => ({ ...m, stageLabel: STAGE_LABELS.saving }))
          } else if (stage === 'video') {
            updateActiveMsg(m => ({ ...m, stageLabel: (data.message as string | undefined) ?? STAGE_LABELS.video_start }))
          }
        } else if (eventName === 'copy_done') {
          const copySlides = (data.slides as DraftVideoSlide[]) ?? []
          updateActiveMsg(m => ({
            ...m,
            stageLabel: `${STAGE_LABELS.copy_done_prefix}${copySlides.length}개 슬라이드`,
            draftSlides: copySlides,
            slideProgress: copySlides.map(s => ({
              slideNumber: s.slideNumber,
              status: 'waiting' as const,
            })),
          }))
        } else if (eventName === 'slide_start') {
          updateActiveMsg(m => ({
            ...m,
            stageLabel: `◎ 슬라이드 ${data.slideNumber}/${data.total} 영상 렌더링 중...`,
            slideProgress: (m.slideProgress ?? []).map(sp =>
              sp.slideNumber === data.slideNumber ? { ...sp, status: 'generating' as const } : sp,
            ),
          }))
        } else if (eventName === 'slide_polling') {
          updateActiveMsg(m => ({
            ...m,
            slideProgress: (m.slideProgress ?? []).map(sp =>
              sp.slideNumber === data.slideNumber ? { ...sp, status: 'generating' as const, elapsed: data.elapsed as number } : sp,
            ),
          }))
        } else if (eventName === 'slide_done') {
          updateActiveMsg(m => ({
            ...m,
            slideProgress: (m.slideProgress ?? []).map(sp =>
              sp.slideNumber === data.slideNumber ? { ...sp, status: 'done' as const } : sp,
            ),
          }))
        } else if (eventName === 'slide_error') {
          updateActiveMsg(m => ({
            ...m,
            slideProgress: (m.slideProgress ?? []).map(sp =>
              sp.slideNumber === data.slideNumber ? { ...sp, status: 'error' as const, error: data.error as string } : sp,
            ),
          }))
        } else if (eventName === 'done') {
          const resultSlides = (data.slides as VideoSlide[]) ?? []
          const campaignId = data.campaignId as string | undefined
          const successCount = resultSlides.filter(s => s.videoUrl).length
          updateActiveMsg(m => ({
            ...m,
            type: 'result',
            stageLabel: `✓ ${successCount}개 영상 완성 — 편집 화면으로 이동합니다`,
            slides: resultSlides,
            partialFailures: (data.partialFailures as number) ?? 0,
          }))
          if (campaignId) {
            setRedirecting(true)
            setPhase('done')
            referenceImagesRef.current = []
            const path = locale === 'en' ? `/en/campaign/${campaignId}` : `/ko/campaign/${campaignId}`
            setTimeout(() => router.push(path), 1400)
          }
        } else if (eventName === 'error') {
          updateActiveMsg(m => ({ ...m, type: 'error', errorText: data.error as string }))
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          const eventMatch = part.match(/^event: (\S+)\ndata: ([\s\S]+)$/)
          if (eventMatch) processEvent(eventMatch[1], eventMatch[2])
        }
      }

    } catch (err) {
      clearTimeout(timeoutId)
      if (controller.signal.aborted && stopRequestedRef.current) {
        updateActiveMsg(m => ({
          ...m,
          type: 'cancelled',
          stageLabel: '생성을 중단했습니다. 완료되지 않은 슬라이드는 저장되지 않았습니다.',
          slideProgress: (m.slideProgress ?? []).map(sp =>
            sp.status === 'generating' || sp.status === 'waiting'
              ? { ...sp, status: 'error' as const, error: '중단됨' }
              : sp,
          ),
        }))
        setPhase('idle')
        return
      }
      const msg = err instanceof Error
        ? (err.name === 'AbortError' ? '요청 시간이 초과되었습니다. 슬라이드 수를 줄이거나 다시 시도해주세요.' : err.message)
        : '서버 오류가 발생했습니다.'
      updateActiveMsg(m => ({ ...m, type: 'error', errorText: msg }))
    } finally {
      setGenerating(false)
      activeMsgIdRef.current = null
      if (generationAbortRef.current === controller) {
        generationAbortRef.current = null
      }
    }
  }

  const handleStopGenerate = () => {
    if (!generationAbortRef.current && !pingAbortRef.current && !isStartingGeneration && phase !== 'generating') return
    startingGenerationRef.current = false
    setIsStartingGeneration(false)
    stopRequestedRef.current = true
    pingAbortRef.current?.abort()
    pingAbortRef.current = null

    if (generationAbortRef.current) {
      generationAbortRef.current.abort()
      updateActiveMsg(m => ({
        ...m,
        stageLabel: '생성을 중단하는 중입니다...',
      }))
      return
    }

    setPhase(collectedInfo.rawTopic ? 'confirming' : 'idle')
    setAiMessages(prev => [...prev, {
      id: `ai-cancel-${Date.now()}`,
      type: 'cancelled',
      stageLabel: '생성 시작을 중단했습니다.',
    }])
  }

  const callAgent = async (userResponseContent: string) => {
    setIsWaiting(true)
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = []
    
    for (let i = 0; i < userMessages.length; i++) {
      const u = userMessages[i]
      history.push({ role: 'user', content: u.content })
      
      const a = aiMessages[i]
      if (a && !a.id.startsWith('ai-temp-')) {
        if (a.type === 'clarify' && a.text) {
          history.push({ role: 'assistant', content: a.text })
        }
      }
    }
    history.push({ role: 'user', content: userResponseContent })
    const sceneDirections = getSceneDirectionsFromMessages(history)

    try {
      const res = await fetch('/api/agents/video-cardnews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          brandId: brand.id,
          language: locale === 'en' ? 'en' : 'ko',
        }),
      })

      const data = await res.json().catch(() => null) as {
        message: string
        ready: boolean
        params?: {
          topic: string
          targetAndMessage?: string
          mood?: string
          objective?: string
          cta?: string
          mustInclude?: string
          avoid?: string
        }
        clarification?: ClarificationPrompt
        error?: string
      } | null

      if (!res.ok || !data) {
        throw new Error(data?.error || `디렉터 API 호출에 실패했습니다. (${res.status})`)
      }

      setAiMessages(prev => {
        const next = [...prev]
        const tempIdx = next.findIndex(m => m.id.startsWith('ai-temp-'))
        const readyInfo = data.ready && data.params
          ? {
              rawTopic: data.params.topic,
              targetAndMessage: data.params.targetAndMessage,
              mood: data.params.mood,
              objective: data.params.objective,
              cta: data.params.cta,
              mustInclude: data.params.mustInclude,
              avoid: data.params.avoid,
              sceneDirections,
              videoContinuityMode: 'separate' as const,
              refinedTopic: buildRefinedTopic({
                rawTopic: data.params.topic,
                targetAndMessage: data.params.targetAndMessage ?? '',
                mood: data.params.mood ?? '',
                objective: data.params.objective ?? '',
                cta: data.params.cta ?? '',
                mustInclude: data.params.mustInclude ?? '',
                avoid: data.params.avoid ?? '',
              }),
              videoPlan: buildEditableVideoPlan({
                rawTopic: data.params.topic,
                targetAndMessage: data.params.targetAndMessage,
                mood: data.params.mood,
                objective: data.params.objective,
                cta: data.params.cta,
                mustInclude: data.params.mustInclude,
                avoid: data.params.avoid,
                sceneDirections,
              }, slideCount, brand),
            }
          : null
        const updatedMsg: AiChatMessage = data.ready && data.params
          ? {
              id: `ai-confirm-${Date.now()}`,
              type: 'confirm',
              text: data.message,
              confirmInfo: readyInfo ?? undefined,
            }
          : {
              id: `ai-clarify-${Date.now()}`,
              type: 'clarify',
              text: data.message,
              clarification: data.clarification,
            }
        
        if (tempIdx !== -1) {
          next[tempIdx] = updatedMsg
        } else {
          next.push(updatedMsg)
        }
        return next
      })

      if (data.ready && data.params) {
        setCollectedInfo({
          rawTopic: data.params.topic,
          targetAndMessage: data.params.targetAndMessage,
          mood: data.params.mood,
          objective: data.params.objective,
          cta: data.params.cta,
          mustInclude: data.params.mustInclude,
          avoid: data.params.avoid,
          sceneDirections,
          videoContinuityMode: 'separate',
          refinedTopic: buildRefinedTopic({
            rawTopic: data.params.topic,
            targetAndMessage: data.params.targetAndMessage ?? '',
            mood: data.params.mood ?? '',
            objective: data.params.objective ?? '',
            cta: data.params.cta ?? '',
            mustInclude: data.params.mustInclude ?? '',
            avoid: data.params.avoid ?? '',
          }),
          videoPlan: buildEditableVideoPlan({
            rawTopic: data.params.topic,
            targetAndMessage: data.params.targetAndMessage,
            mood: data.params.mood,
            objective: data.params.objective,
            cta: data.params.cta,
            mustInclude: data.params.mustInclude,
            avoid: data.params.avoid,
            sceneDirections,
          }, slideCount, brand),
        })
        setPhase('confirming')
      } else {
        setPhase('clarifying')
      }

    } catch (err) {
      console.error(err)
      const errorText = err instanceof Error
        ? err.message
        : '디렉터와의 연결 중 오류가 발생했습니다. 다시 시도해 주세요.'
      setAiMessages(prev => {
        const next = [...prev]
        const tempIdx = next.findIndex(m => m.id.startsWith('ai-temp-'))
        const errMsg: AiChatMessage = {
          id: `ai-err-${Date.now()}`,
          type: 'error',
          errorText,
        }
        if (tempIdx !== -1) {
          next[tempIdx] = errMsg
        } else {
          next.push(errMsg)
        }
        return next
      })
    } finally {
      setIsWaiting(false)
    }
  }

  // ── 대화형 흐름 핸들러 ──────────────────────────────────────────

  const handleSend = async () => {
    const input = topic.trim()
    if ((!input && attachedImages.length === 0) || generating || isWaiting || isStartingGeneration) return
    setTopic('')

    const imageUrls = attachedImages.map(img => img.preview)
    if (attachedImages.length > 0) {
      referenceImagesRef.current = attachedImages
    }
    setAttachedImages([])

    // 유저 메시지 표시
    const userMsg: UserChatMessage = {
      id: `u-${Date.now()}`,
      content: input,
      images: imageUrls,
    }
    flushSync(() => setUserMessages(prev => [...prev, userMsg]))

    const tempAiId = `ai-temp-${Date.now()}`
    flushSync(() => {
      setAiMessages(prev => [...prev, {
        id: tempAiId,
        type: 'progress',
        stageLabel: '✦ AI 디렉터가 입력 내용을 분석하고 있습니다...',
      }])
    })

    await callAgent(input)
  }

  const handleClarificationSelect = async (option: ClarificationOption) => {
    if (generating || isWaiting || isStartingGeneration || phase === 'confirming') return
    const text = option.value
    const userLabel = option.label

    const userMsg: UserChatMessage = { id: `u-${Date.now()}`, content: userLabel }
    flushSync(() => {
      setUserMessages(prev => [...prev, userMsg])
    })

    const tempAiId = `ai-temp-${Date.now()}`
    flushSync(() => {
      setAiMessages(prev => [...prev, {
        id: tempAiId,
        type: 'progress',
        stageLabel: '✦ AI 디렉터가 선택하신 답변을 반영하고 있습니다...',
      }])
    })

    await callAgent(text)
  }

  const _handleConfirmGenerate = () => {
    if (!collectedInfo.rawTopic) return
    flushSync(() => {
      setUserMessages(prev => [...prev, { id: `u-confirm-${Date.now()}`, content: '지금 만들기' }])
    })
    void runGenerate(collectedInfo as CollectedInfo)
  }

  const pingVideoProvider = async (signal?: AbortSignal) => {
    const res = await fetch('/api/video-cardnews/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
    })
    const data = await res.json().catch(() => null) as { ok?: boolean; error?: string } | null
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || '?? ?? API 연결 확인에 실패했습니다.')
    }
  }

  const handleConfirmGenerateWithPing = async () => {
    if (!collectedInfo.rawTopic || startingGenerationRef.current || generating) return
    const fallbackVideoPlan = buildEditableVideoPlan({
      rawTopic: collectedInfo.rawTopic,
      targetAndMessage: collectedInfo.targetAndMessage,
      mood: collectedInfo.mood,
      objective: collectedInfo.objective,
      cta: collectedInfo.cta,
      mustInclude: collectedInfo.mustInclude,
      avoid: collectedInfo.avoid,
      sceneDirections: collectedInfo.sceneDirections,
    }, slideCount, brand)
    if (!collectedInfo.videoPlan?.length) {
      setCollectedInfo(prev => ({ ...prev, videoPlan: fallbackVideoPlan }))
      setAiMessages(prev => prev.map(message => {
        if (message.type !== 'confirm' || !message.confirmInfo) return message
        return {
          ...message,
          confirmInfo: {
            ...message.confirmInfo,
            videoPlan: fallbackVideoPlan,
          },
        }
      }))
      return
    }

    const infoForGeneration: CollectedInfo = {
      rawTopic: collectedInfo.rawTopic,
      targetAndMessage: collectedInfo.targetAndMessage,
      mood: collectedInfo.mood,
      objective: collectedInfo.objective,
      cta: collectedInfo.cta,
      mustInclude: collectedInfo.mustInclude,
      avoid: collectedInfo.avoid,
      sceneDirections: collectedInfo.sceneDirections,
      videoContinuityMode: collectedInfo.videoContinuityMode ?? 'separate',
      refinedTopic: collectedInfo.refinedTopic ?? buildRefinedTopic({
        rawTopic: collectedInfo.rawTopic,
        targetAndMessage: collectedInfo.targetAndMessage ?? '',
        mood: collectedInfo.mood ?? '',
        objective: collectedInfo.objective ?? '',
        cta: collectedInfo.cta ?? '',
        mustInclude: collectedInfo.mustInclude ?? '',
        avoid: collectedInfo.avoid ?? '',
      }),
      videoPlan: collectedInfo.videoPlan,
    }
    stopRequestedRef.current = false
    startingGenerationRef.current = true
    setIsStartingGeneration(true)
    const pingController = new AbortController()
    pingAbortRef.current = pingController
    try {
      await pingVideoProvider(pingController.signal)
    } catch (error) {
      startingGenerationRef.current = false
      setIsStartingGeneration(false)
      pingAbortRef.current = null
      if (pingController.signal.aborted && stopRequestedRef.current) {
        setPhase(collectedInfo.rawTopic ? 'confirming' : 'idle')
        return
      }
      const message = error instanceof Error ? error.message : '?? ?? API 연결 확인에 실패했습니다.'
      setAiMessages(prev => [...prev, {
        id: `ai-ping-error-${Date.now()}`,
        type: 'error',
        errorText: message,
      }])
      return
    } finally {
      if (pingAbortRef.current === pingController) {
        pingAbortRef.current = null
      }
    }
    flushSync(() => {
      setUserMessages(prev => [...prev, { id: `u-confirm-${Date.now()}`, content: '지금 만들기' }])
    })
    try {
      await runGenerate(infoForGeneration)
    } finally {
      startingGenerationRef.current = false
      setIsStartingGeneration(false)
    }
  }

  const handleConfirmInfoChange = (patch: Partial<CollectedInfo>) => {
    setCollectedInfo(prev => {
      const next = { ...prev, ...patch }
      if (next.rawTopic) {
        next.refinedTopic = buildRefinedTopic({
        rawTopic: next.rawTopic,
        targetAndMessage: next.targetAndMessage ?? '',
        mood: next.mood ?? '',
        objective: next.objective ?? '',
        cta: next.cta ?? '',
        mustInclude: next.mustInclude ?? '',
        avoid: next.avoid ?? '',
      })
      }
      return next
    })
    setAiMessages(prev => prev.map(message => {
      if (message.type !== 'confirm' || !message.confirmInfo) return message
      const nextInfo = { ...message.confirmInfo, ...patch }
      nextInfo.refinedTopic = buildRefinedTopic({
        rawTopic: nextInfo.rawTopic,
        targetAndMessage: nextInfo.targetAndMessage ?? '',
        mood: nextInfo.mood ?? '',
        objective: nextInfo.objective ?? '',
        cta: nextInfo.cta ?? '',
        mustInclude: nextInfo.mustInclude ?? '',
        avoid: nextInfo.avoid ?? '',
      })
      return { ...message, confirmInfo: nextInfo }
    }))
  }

  const handleVideoPlanChange = (slideNumber: number, patch: Partial<VideoPlanSlide>) => {
    const updatePlan = (plan?: VideoPlanSlide[]) =>
      (plan ?? buildEditableVideoPlan({
        rawTopic: collectedInfo.rawTopic ?? '',
        targetAndMessage: collectedInfo.targetAndMessage,
        mood: collectedInfo.mood,
        objective: collectedInfo.objective,
        cta: collectedInfo.cta,
        mustInclude: collectedInfo.mustInclude,
        avoid: collectedInfo.avoid,
        sceneDirections: collectedInfo.sceneDirections,
      }, slideCount, brand)).map(slide =>
        slide.slideNumber === slideNumber ? { ...slide, ...patch } : slide,
      )

    setCollectedInfo(prev => ({
      ...prev,
      videoPlan: updatePlan(prev.videoPlan),
    }))
    setAiMessages(prev => prev.map(message => {
      if (message.type !== 'confirm' || !message.confirmInfo) return message
      return {
        ...message,
        confirmInfo: {
          ...message.confirmInfo,
          videoPlan: updatePlan(message.confirmInfo.videoPlan),
        },
      }
    }))
  }

  const handleSlideCountChange = (nextCount: 3 | 5 | 7) => {
    setSlideCount(nextCount)
    if (phase !== 'confirming' || !collectedInfo.rawTopic) return
    const nextPlan = buildEditableVideoPlan({
      rawTopic: collectedInfo.rawTopic,
      targetAndMessage: collectedInfo.targetAndMessage,
      mood: collectedInfo.mood,
      objective: collectedInfo.objective,
      cta: collectedInfo.cta,
      mustInclude: collectedInfo.mustInclude,
      avoid: collectedInfo.avoid,
      sceneDirections: collectedInfo.sceneDirections,
    }, nextCount, brand)
    setCollectedInfo(prev => ({
      ...prev,
      videoPlan: nextPlan,
      videoContinuityMode: nextCount === 3 ? prev.videoContinuityMode : 'separate',
    }))
    setAiMessages(prev => prev.map(message => {
      if (message.type !== 'confirm' || !message.confirmInfo) return message
      return {
        ...message,
        confirmInfo: {
          ...message.confirmInfo,
          videoPlan: nextPlan,
          videoContinuityMode: nextCount === 3 ? message.confirmInfo.videoContinuityMode : 'separate',
        },
      }
    }))
  }

  const handleReset = () => {
    setPhase('idle')
    setCollectedInfo({})
    setUserMessages([])
    setAiMessages([])
    setTopic('')
    setIsStartingGeneration(false)
    startingGenerationRef.current = false
    referenceImagesRef.current = []
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const generationBusy = generating || isStartingGeneration || phase === 'generating'
  const inputDisabled = generationBusy || isWaiting || phase === 'confirming' || phase === 'done'
  const hasConversation = userMessages.length > 0 || aiMessages.length > 0 || phase !== 'idle'
  const getPlaceholder = () => {
    if (isEn) {
      if (phase === 'idle') return 'Enter a video card news topic...'
      if (phase === 'clarifying') return 'Answer the AI director question...'
      if (phase === 'confirming') return 'Choose Generate now or Start over.'
      return 'Generating...'
    }
    if (phase === 'idle') return '영상 카드뉴스 주제를 입력하세요...'
    if (phase === 'clarifying') return 'AI 디렉터의 질문에 답해 주세요...'
    if (phase === 'confirming') return '[지금 만들기] 또는 [처음부터] 버튼을 눌러주세요'
    return '생성 중...'
  }
  const renderComposer = (mode: 'hero' | 'dock') => {
    const isHero = mode === 'hero'
    return (
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={isHero ? 'w-full max-w-[760px]' : 'relative z-10 shrink-0 bg-transparent px-4 pb-5 pt-3'}
      >
        <div className="space-y-2.5">
          {isDragging && (
            <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-[#6366f1] bg-[#eef2ff] py-3 text-sm font-medium text-[#4f46e5]">
              이미지를 여기에 놓으세요
            </div>
          )}

          {attachedImages.length > 0 && (
            <div className={`flex gap-2 ${isHero ? 'justify-start' : ''}`}>
              {attachedImages.map((img, i) => (
                <div key={i} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[#e5e7eb] shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.preview} alt="" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removeImage(i)}
                    className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className={`rounded-[24px] border border-[#dfe7ff] bg-white/82 shadow-[0_22px_58px_rgba(79,70,229,0.12)] backdrop-blur-xl transition-all focus-within:border-[#c4b5fd] focus-within:bg-white/90 focus-within:shadow-[0_26px_72px_rgba(79,70,229,0.16)] ${isHero ? 'px-5 py-5' : 'px-4 py-3'}`}>
            <textarea
              ref={inputRef}
              rows={isHero ? 4 : 2}
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isHero
                ? (isEn
                  ? 'Ex. A 5-scene video card news that introduces our new sunscreen to office workers in their 20s'
                  : '예: 신제품 출시 소식을 20대 직장인에게 감각적으로 보여주는 5장 영상 카드뉴스')
                : getPlaceholder()}
              disabled={inputDisabled}
              className={`w-full resize-none border-none bg-transparent px-0 text-[#111111] outline-none placeholder-[#a8b0bd] disabled:opacity-50 ${isHero ? 'min-h-[118px] text-[15px] leading-7' : 'text-sm leading-6'}`}
            />

            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={generating || isStartingGeneration || attachedImages.length >= 3}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e5e7eb] bg-white text-[#64748b] transition-colors hover:border-[#cbd5e1] hover:text-[#334155] disabled:opacity-40"
                  title={isEn ? 'Add reference image' : '참고 이미지 추가'}>
                  <ImagePlus className="h-3.5 w-3.5" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={e => { if (e.target.files) addImages(e.target.files); e.target.value = '' }} />
                <div className="flex items-center gap-1 rounded-full border border-[#e5e7eb] bg-white/84 p-1">
                  {([3, 5, 7] as const).map(n => (
                    <button
                      key={n}
                      type="button"
                      disabled={generating || isStartingGeneration || phase === 'generating'}
                      onClick={() => handleSlideCountChange(n)}
                      className={`h-6 rounded-full px-2.5 text-[11px] font-bold transition-all ${
                        slideCount === n
                          ? 'bg-[#4252ff] text-white'
                          : 'text-[#64748b] hover:bg-[#f5f7ff] hover:text-[#3730a3]'
                      } disabled:opacity-50`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {generationBusy ? (
                <button type="button" onClick={handleStopGenerate}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#3f3f46] px-4 text-xs font-bold text-white shadow-[0_10px_22px_rgba(39,39,42,0.18)] transition-colors hover:bg-[#27272a]">
                  <Square className="h-3.5 w-3.5 fill-current" />
                  {isEn ? 'Stop' : '중단하기'}
                </button>
              ) : (
                <button type="button" onClick={handleSend} disabled={inputDisabled || (!topic.trim() && attachedImages.length === 0)}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#4252ff] px-4 text-xs font-bold text-white shadow-[0_12px_28px_rgba(66,82,255,0.22)] transition-all hover:bg-[#3442e8] hover:shadow-[0_16px_34px_rgba(66,82,255,0.26)] disabled:opacity-30">
                  <Send className="h-4 w-4" />
                  {isEn ? 'Start' : '시작'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 편집 화면 전환 오버레이
  if (redirecting) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex h-full flex-col items-center justify-center bg-white"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
          className="flex flex-col items-center gap-6 text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm border border-[#e5e7eb]">
            <Film className="h-7 w-7 text-[#4252ff]" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-bold text-[#111111]">{isEn ? 'Video card news is ready' : '영상 카드뉴스가 완성됐습니다'}</p>
            <p className="text-sm text-[#6b7280] flex items-center gap-2 justify-center">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {isEn ? 'Moving to the editor...' : '편집 화면으로 이동하는 중...'}
            </p>
          </div>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden bg-white">
      <style dangerouslySetInnerHTML={{ __html: `
        .shuffla-video-ambient {
          background:
            radial-gradient(circle at 56% 36%, rgba(219, 234, 254, 0.44), transparent 34%),
            radial-gradient(circle at 82% 42%, rgba(237, 233, 254, 0.56), transparent 32%),
            radial-gradient(circle at 44% 54%, rgba(191, 219, 254, 0.28), transparent 30%),
            linear-gradient(180deg, #ffffff 0%, #fbfdff 58%, #ffffff 100%);
          background-size: 150% 150%;
          animation: shufflaVideoAmbientDrift 26s ease-in-out infinite alternate;
        }
        .shuffla-video-ambient::after {
          content: "";
          position: absolute;
          inset: -18%;
          background:
            radial-gradient(circle at 46% 42%, rgba(96, 165, 250, 0.18), transparent 26%),
            radial-gradient(circle at 72% 48%, rgba(168, 85, 247, 0.16), transparent 30%);
          filter: blur(42px);
          animation: shufflaVideoAmbientFloat 34s ease-in-out infinite alternate;
        }
        @keyframes shufflaVideoAmbientDrift {
          0% { background-position: 0% 0%; transform: scale(1); }
          50% { background-position: 58% 38%; transform: scale(1.025); }
          100% { background-position: 100% 84%; transform: scale(1.045); }
        }
        @keyframes shufflaVideoAmbientFloat {
          0% { transform: translate3d(-2%, -1%, 0) rotate(0deg); opacity: 0.42; }
          100% { transform: translate3d(3%, 2%, 0) rotate(3deg); opacity: 0.58; }
        }
      ` }} />
      {/* Left: Chat */}
      <div className="relative isolate flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 shuffla-video-ambient" />

        {/* Header */}
        <div className="relative z-10 shrink-0 border-b border-white/60 bg-white/55 px-5 py-3 backdrop-blur-xl flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#111111]">
            <Clapperboard className="h-3.5 w-3.5" />
            {isEn ? 'Video card news' : '영상 카드뉴스'}
            <span className="rounded-full bg-[#111827] px-1.5 py-0.5 text-[9px] font-black text-white tracking-wide">BETA</span>
          </div>
          <div className="flex items-center gap-3">
            {(phase !== 'idle' && phase !== 'generating' && phase !== 'done') && (
              <button type="button" onClick={handleReset}
                className="flex items-center gap-1 text-[11px] text-[#9ca3af] hover:text-[#6b7280] transition-colors">
                <RotateCcw className="h-3 w-3" />
                {isEn ? 'Start over' : '처음부터'}
              </button>
            )}
            <div className="text-xs text-[#9ca3af]">
              {brand.name}
            </div>
          </div>
        </div>

        {hasConversation ? (
          <>
            <div className="relative z-10 flex-1 overflow-y-auto bg-transparent px-6 py-8">
              <div className="mx-auto flex w-full max-w-[920px] flex-col gap-7">
                <AnimatePresence initial={false}>
                  {userMessages.map((umsg, idx) => (
                    <motion.div key={umsg.id}
                      initial={{ opacity: 0, y: 14, scale: 0.985, filter: 'blur(6px)' }}
                      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                      transition={smoothEase}
                      className="contents"
                    >
                      <div className="flex justify-end">
                        <div className="max-w-[78%] rounded-[20px] rounded-tr-md bg-[#4252ff] px-4 py-3 text-sm font-bold leading-6 text-white shadow-[0_18px_42px_rgba(66,82,255,0.20)] whitespace-pre-wrap flex flex-col gap-2">
                          {umsg.images && umsg.images.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 justify-end">
                              {umsg.images.map((img, i) => (
                                <div key={i} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-white/40 shadow-sm">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={img} alt="" className="h-full w-full object-cover" />
                                </div>
                              ))}
                            </div>
                          )}
                          {umsg.content && <div>{umsg.content}</div>}
                        </div>
                      </div>
                      {aiMessages[idx] && (
                        <AiMessage
                          msg={aiMessages[idx]}
                          onConfirmGenerate={handleConfirmGenerateWithPing}
                          onConfirmInfoChange={handleConfirmInfoChange}
                          onVideoPlanChange={handleVideoPlanChange}
                          slideCount={slideCount}
                          brand={brand}
                          confirmBusy={isStartingGeneration || generating || phase === 'generating'}
                          onReset={handleReset}
                          onClarificationSelect={handleClarificationSelect}
                          onStopGenerate={handleStopGenerate}
                        />
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {aiMessages.slice(userMessages.length).map(msg => (
                  <AiMessage
                    key={msg.id}
                    msg={msg}
                    onConfirmGenerate={handleConfirmGenerateWithPing}
                    onConfirmInfoChange={handleConfirmInfoChange}
                    onVideoPlanChange={handleVideoPlanChange}
                    slideCount={slideCount}
                    brand={brand}
                    confirmBusy={isStartingGeneration || generating || phase === 'generating'}
                    onReset={handleReset}
                    onClarificationSelect={handleClarificationSelect}
                    onStopGenerate={handleStopGenerate}
                  />
                ))}

                <div ref={chatBottomRef} />
              </div>
            </div>
            {renderComposer('dock')}
          </>
        ) : (
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-8">
            <motion.div
              {...fadeIn}
              transition={{ ...smoothEase, delay: 0.03 }}
              className="flex w-full max-w-[820px] flex-col items-center text-center"
            >
              <h1 className="text-[30px] font-black tracking-[-0.01em] text-[#111827] md:text-[34px]">
                {isEn ? 'What video card news should we make?' : '어떤 영상 카드뉴스를 만들까요?'}
              </h1>
              <p className="mt-3 max-w-[560px] text-sm font-medium leading-6 text-[#64748b]">
                {isEn
                  ? 'Enter a topic, target, and mood first. Shuffla will plan scenes, titles, body copy, and video prompts.'
                  : '주제, 타깃, 분위기만 입력하면 장면 흐름과 제목, 본문, ?? 프롬프트를 먼저 기획합니다.'}
              </p>

              <div className="mt-6 w-full">
                {renderComposer('hero')}
              </div>

              <VideoCardNewsHeroMockup />
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────

function VideoCardNewsHeroMockup() {
  const cards = [
    {
      label: '01',
      title: '장면을 열고',
      body: '짧은 영상으로 시선을 잡습니다',
      tone: 'from-[#dbeafe] via-[#f4f7ff] to-[#ffffff]',
      panel: 'bg-[#111827]',
    },
    {
      label: '02',
      title: '메시지를 얹고',
      body: '제목과 본문을 카드 하단에 정리합니다',
      tone: 'from-[#ede9fe] via-[#f8f7ff] to-[#ffffff]',
      panel: 'bg-[#0f172a]',
    },
    {
      label: '03',
      title: '흐름을 완성',
      body: '연결된 카드뉴스로 저장합니다',
      tone: 'from-[#e0f2fe] via-[#f5f3ff] to-[#ffffff]',
      panel: 'bg-[#18181b]',
    },
  ]

  return (
    <div className="mt-10 flex w-full max-w-[720px] items-end justify-center gap-3 px-4">
      {cards.map((card, index) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 18, rotate: index === 0 ? -2 : index === 2 ? 2 : 0 }}
          animate={{ opacity: 1, y: 0, rotate: index === 0 ? -2 : index === 2 ? 2 : 0 }}
          transition={{ duration: 0.72, delay: 0.1 + index * 0.08, ease: [0.19, 1, 0.22, 1] }}
          className={`relative w-[30%] min-w-[96px] max-w-[150px] overflow-hidden rounded-[18px] border border-white/80 bg-white/70 p-1.5 shadow-[0_22px_60px_rgba(79,70,229,0.12)] backdrop-blur-xl ${index === 1 ? 'mb-5 scale-105' : 'mb-0'}`}
        >
          <div className="aspect-[4/5] overflow-hidden rounded-[14px] bg-white">
            <div className={`relative h-[48%] bg-gradient-to-br ${card.tone}`}>
              <div className="absolute inset-x-3 top-3 flex items-center justify-between">
                <span className="h-1.5 w-8 rounded-full bg-white/80" />
                <span className="h-5 w-5 rounded-full bg-white/70" />
              </div>
              <div className="absolute left-3 top-10 h-10 w-10 rounded-2xl bg-white/58 shadow-sm" />
              <div className="absolute bottom-4 right-3 h-14 w-9 rounded-full bg-white/68 shadow-sm" />
              <div className="absolute bottom-3 left-3 h-2 w-16 rounded-full bg-white/80" />
            </div>
            <div className={`${card.panel} flex h-[52%] flex-col justify-between p-3 text-left text-white`}>
              <span className="text-[9px] font-black tracking-[0.18em] text-white/42">{card.label}</span>
              <div>
                <p className="text-[13px] font-black leading-4">{card.title}</p>
                <p className="mt-2 text-[10px] font-semibold leading-4 text-white/58">{card.body}</p>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function AiBubbleAvatar() {
  return (
    <span className="text-[11px] font-semibold text-[#6b7280] tracking-wide">Shuffla</span>
  )
}

function AiMessage({
  msg,
  onConfirmGenerate,
  onConfirmInfoChange,
  onVideoPlanChange,
  slideCount,
  brand,
  confirmBusy = false,
  onReset,
  onClarificationSelect,
  onStopGenerate,
}: {
  msg: AiChatMessage
  onConfirmGenerate: () => void
  onConfirmInfoChange?: (patch: Partial<CollectedInfo>) => void
  onVideoPlanChange?: (slideNumber: number, patch: Partial<VideoPlanSlide>) => void
  slideCount: number
  brand: Brand
  confirmBusy?: boolean
  onReset: () => void
  onClarificationSelect?: (option: ClarificationOption) => void
  onStopGenerate?: () => void
}) {
  if (msg.type === 'clarify') {
    return (
      <motion.div
        {...fadeIn}
        transition={smoothEase}
        className="flex justify-start"
      >
        <div className="flex flex-col gap-2.5 items-start max-w-md">
          <AiBubbleAvatar />
          <div className="rounded-[20px] rounded-tl-md border border-white/70 bg-white/70 px-4 py-3.5 text-sm leading-7 text-[#111111] shadow-[0_16px_38px_rgba(79,70,229,0.10)] backdrop-blur-xl whitespace-pre-line flex flex-col gap-3 w-full">
            <div>{msg.text}</div>
            
            {msg.clarification && msg.clarification.options && onClarificationSelect && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-[#f3f4f6]">
                {msg.clarification.options.map((opt, oIdx) => (
                  <button
                    key={oIdx}
                    type="button"
                    onClick={() => onClarificationSelect(opt)}
                    className="rounded-xl border border-white/70 bg-white/48 px-2.5 py-1.5 text-xs text-[#374151] shadow-sm transition-all hover:border-[#c4b5fd] hover:bg-white/72 hover:text-[#111111] active:scale-[0.98]"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  if (msg.type === 'confirm' && msg.confirmInfo) {
    const info = msg.confirmInfo
    const hasConfirmedVideoPlan = Boolean(info.videoPlan?.length)
    const videoPlan = info.videoPlan?.length
      ? info.videoPlan
      : buildEditableVideoPlan(info, slideCount, brand)
    if (onConfirmInfoChange) {
      return (
        <motion.div
          {...fadeIn}
          transition={smoothEase}
          className="flex justify-start"
        >
          <div className="flex w-full max-w-[920px] flex-col items-start gap-2.5">
            <AiBubbleAvatar />
            <div className="w-full space-y-4 rounded-[20px] rounded-tl-md border border-white/70 bg-white/70 px-4 py-4 shadow-[0_16px_42px_rgba(79,70,229,0.11)] backdrop-blur-xl">
              <div className="space-y-1">
                <p className="text-sm font-bold text-[#111111]">생성 전에 기획안을 확인해주세요.</p>
                <p className="text-xs font-medium leading-5 text-[#6b7280]">필요한 내용을 직접 수정한 뒤 생성할 수 있습니다.</p>
              </div>

              <div className="space-y-3 text-sm">
                <EditablePlanField
                  label="주제"
                  value={info.rawTopic}
                  rows={2}
                  disabled={confirmBusy}
                  onChange={value => onConfirmInfoChange({ rawTopic: value })}
                />
                <EditablePlanField
                  label="독자 및 메시지"
                  value={info.targetAndMessage ?? ''}
                  rows={4}
                  placeholder="누구에게 어떤 메시지를 전달할지 입력하세요."
                  disabled={confirmBusy}
                  onChange={value => onConfirmInfoChange({ targetAndMessage: value })}
                />
                <EditablePlanField
                  label="분위기"
                  value={info.mood ?? ''}
                  rows={3}
                  placeholder="영상의 톤, 색감, 장면 분위기를 입력하세요."
                  disabled={confirmBusy}
                  onChange={value => onConfirmInfoChange({ mood: value })}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <EditablePlanField
                    label="제작 목적"
                    value={info.objective ?? ''}
                    rows={3}
                    placeholder="홍보, 안내, 교육, 판매, 브랜드 인지도 등 목적을 입력하세요."
                    disabled={confirmBusy}
                    onChange={value => onConfirmInfoChange({ objective: value })}
                  />
                  <EditablePlanField
                    label="CTA"
                    value={info.cta ?? ''}
                    rows={3}
                    placeholder="마지막에 유도할 행동을 입력하세요."
                    disabled={confirmBusy}
                    onChange={value => onConfirmInfoChange({ cta: value })}
                  />
                  <EditablePlanField
                    label="반드시 포함"
                    value={info.mustInclude ?? ''}
                    rows={3}
                    placeholder="제품명, 혜택, 날짜, 장소, 기능 등 꼭 들어갈 정보를 입력하세요."
                    disabled={confirmBusy}
                    onChange={value => onConfirmInfoChange({ mustInclude: value })}
                  />
                  <EditablePlanField
                    label="피해야 할 내용"
                    value={info.avoid ?? ''}
                    rows={3}
                    placeholder="과장 표현, 금지어, 특정 장면, 불확실한 수치 등을 입력하세요."
                    disabled={confirmBusy}
                    onChange={value => onConfirmInfoChange({ avoid: value })}
                  />
                </div>
              </div>

              <VideoContinuitySelector
                value={info.videoContinuityMode ?? 'separate'}
                slideCount={slideCount}
                disabled={confirmBusy}
                onChange={value => onConfirmInfoChange({ videoContinuityMode: value })}
              />

              {videoPlan.length > 0 && onVideoPlanChange && (
                <div className="space-y-3 border-t border-[#f3f4f6] pt-3">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-[#111111]">카드별 영상 생성 프롬프트</p>
                    <p className="text-[11px] font-medium leading-5 text-[#6b7280]">
                      각 카드의 장면, 제목, 본문, ?? 프롬프트입니다. 수정한 내용이 실제 생성에 사용됩니다.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {videoPlan.map(slide => (
                      <EditableVideoPromptCard
                        key={slide.slideNumber}
                        slide={slide}
                        disabled={confirmBusy}
                        onChange={patch => onVideoPlanChange(slide.slideNumber, patch)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 border-t border-[#f3f4f6] pt-1">
                <button
                  type="button"
                  onClick={onConfirmGenerate}
                  disabled={confirmBusy || !info.rawTopic.trim()}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#111827] py-2.5 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(15,23,42,0.16)] transition-all hover:bg-[#1f2937] hover:shadow-[0_16px_32px_rgba(15,23,42,0.2)] disabled:opacity-40"
                >
                  {confirmBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {confirmBusy ? '확인 중...' : hasConfirmedVideoPlan ? '지금 만들기' : '프롬프트 확정하기'}
                </button>
                <button
                  type="button"
                  onClick={onReset}
                  disabled={confirmBusy}
                  className="rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-xs text-[#6b7280] transition-colors hover:bg-[#f9fafb]"
                >
                  처음부터
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )
    }
    return (
      <motion.div
        {...fadeIn}
        transition={smoothEase}
        className="flex justify-start"
      >
        <div className="flex flex-col gap-2.5 items-start max-w-sm w-full">
          <AiBubbleAvatar />
          <div className="rounded-[20px] rounded-tl-md border border-white/70 bg-white/70 px-4 py-4 w-full space-y-4 shadow-[0_16px_42px_rgba(79,70,229,0.11)] backdrop-blur-xl">
            <p className="text-sm font-bold text-[#111111]">완벽해요! 이렇게 만들게요.</p>

            <div className="space-y-2.5 text-sm">
              <div className="flex gap-2.5">
                <span className="text-base leading-5">📌</span>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#9ca3af]">주제</span>
                  <p className="text-[#111111] leading-5 mt-0.5">{info.rawTopic}</p>
                </div>
              </div>
              {info.targetAndMessage && (
                <div className="flex gap-2.5">
                  <span className="text-base leading-5">👥</span>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#9ca3af]">독자 & 메시지</span>
                    <p className="text-[#111111] leading-5 mt-0.5">{info.targetAndMessage}</p>
                  </div>
                </div>
              )}
              {info.mood && (
                <div className="flex gap-2.5">
                  <span className="text-base leading-5">🎬</span>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#9ca3af]">분위기</span>
                    <p className="text-[#111111] leading-5 mt-0.5">{info.mood}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1 border-t border-[#f3f4f6]">
              <button
                type="button"
                onClick={onConfirmGenerate}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#111827] py-2.5 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(15,23,42,0.16)] transition-all hover:bg-[#1f2937] hover:shadow-[0_16px_32px_rgba(15,23,42,0.2)]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                지금 만들기
              </button>
              <button
                type="button"
                onClick={onReset}
                className="rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-xs text-[#6b7280] hover:bg-[#f9fafb] transition-colors"
              >
                처음부터
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  return <AiProgressMessage msg={msg} onStopGenerate={onStopGenerate} />
}

function VideoContinuitySelector({
  value,
  slideCount,
  disabled,
  onChange,
}: {
  value: VideoContinuityMode
  slideCount: number
  disabled?: boolean
  onChange: (value: VideoContinuityMode) => void
}) {
  const continuousAvailable = slideCount === 3
  const options: Array<{
    value: VideoContinuityMode
    title: string
    description: string
    icon: typeof Rows3
    disabled?: boolean
  }> = [
    {
      value: 'separate',
      title: '따로 만들어도 괜찮아요',
      description: '카드마다 다른 장면을 독립적으로 생성합니다.',
      icon: Rows3,
    },
    {
      value: 'continuous',
      title: '모두 이어져야 해요',
      description: continuousAvailable
        ? '긴 원본 영상 하나를 만들고 0/3/6초로 나눕니다.'
        : '현재는 3장 구성에서만 사용할 수 있습니다.',
      icon: Link2,
      disabled: !continuousAvailable,
    },
  ]

  return (
    <div className="space-y-2 border-t border-[#f3f4f6] pt-3">
      <div className="space-y-1">
        <p className="text-xs font-bold text-[#111111]">장면 연결 방식</p>
        <p className="text-[11px] font-medium leading-5 text-[#6b7280]">
          영상들이 하나의 흐름으로 이어져야 하는지, 카드별로 독립 생성해도 되는지 선택해주세요.
        </p>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {options.map(option => {
          const Icon = option.icon
          const active = value === option.value
          const optionDisabled = disabled || option.disabled
          return (
            <button
              key={option.value}
              type="button"
              disabled={optionDisabled}
              onClick={() => onChange(option.value)}
              className={`flex items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-all ${
                active
                  ? 'border-[#4252ff] bg-[#f5f7ff] shadow-[0_12px_30px_rgba(66,82,255,0.10)]'
                  : 'border-[#e5e7eb] bg-white/72 hover:border-[#c7d2fe] hover:bg-white'
              } disabled:cursor-not-allowed disabled:opacity-45`}
            >
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                active ? 'bg-[#4252ff] text-white' : 'bg-[#f8fafc] text-[#64748b]'
              }`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-black text-[#111827]">{option.title}</span>
                <span className="mt-1 block text-[11px] font-medium leading-5 text-[#6b7280]">{option.description}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function EditablePlanField({
  label,
  value,
  rows,
  placeholder,
  disabled = false,
  onChange,
}: {
  label: string
  value: string
  rows: number
  placeholder?: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9ca3af]">{label}</span>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        onChange={event => onChange(event.target.value)}
        className="w-full resize-none rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-xs font-semibold leading-5 text-[#111111] outline-none transition-all placeholder:text-[#b6bcc6] focus:border-[#c4b5fd] focus:shadow-[0_10px_24px_rgba(79,70,229,0.10)] disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:text-[#94a3b8]"
      />
    </label>
  )
}

function EditableVideoPromptCard({
  slide,
  disabled,
  onChange,
}: {
  slide: VideoPlanSlide
  disabled?: boolean
  onChange: (patch: Partial<VideoPlanSlide>) => void
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#e5e7eb] bg-white/78 p-3 shadow-[0_12px_28px_rgba(79,70,229,0.10)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-full bg-[#111827] px-2 py-0.5 text-[10px] font-bold text-white">
          Card {slide.slideNumber}
        </span>
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#9ca3af]">{roleLabel(slide.role)}</span>
      </div>
      <div className="space-y-2">
        <EditablePlanField
          label="제목"
          value={slide.headline}
          rows={2}
          disabled={disabled}
          onChange={value => onChange({ headline: value })}
        />
        <EditablePlanField
          label="본문"
          value={slide.body}
          rows={3}
          disabled={disabled}
          onChange={value => onChange({ body: value })}
        />
        <EditablePlanField
          label="영상 프롬프트"
          value={slide.videoPrompt}
          rows={7}
          disabled={disabled}
          onChange={value => onChange({ videoPrompt: value })}
        />
      </div>
    </div>
  )
}

function AiProgressMessage({ msg, onStopGenerate }: { msg: AiChatMessage; onStopGenerate?: () => void }) {
  return (
    <motion.div
      {...fadeIn}
      transition={smoothEase}
      className="flex justify-start"
    >
      <div className="flex w-full max-w-2xl flex-col items-start gap-2.5">
        <AiBubbleAvatar />

        {/* Error */}
        {msg.type === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3.5 text-sm text-red-700 max-w-md shadow-sm">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-xs mb-1">생성 중 오류가 발생했습니다</p>
              <p className="text-xs leading-5 text-red-600">{msg.errorText}</p>
              <p className="text-[10px] mt-2 text-red-400">잠시 후 다시 시도해주세요.</p>
            </div>
          </motion.div>
        )}

        {/* Progress / result */}
        {msg.type !== 'error' && msg.type !== 'clarify' && msg.type !== 'confirm' && (
          <div className="rounded-[20px] rounded-tl-md border border-white/70 bg-white/70 px-4 py-3.5 w-full space-y-3 shadow-[0_16px_38px_rgba(79,70,229,0.10)] backdrop-blur-xl">
            <div className="flex items-center gap-2">
              {msg.type === 'progress' && (
                <Loader2 className="h-3.5 w-3.5 text-[#4252ff] animate-spin shrink-0" />
              )}
              {msg.type === 'result' && (
                <Sparkles className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              )}
              {msg.type === 'cancelled' && (
                <Square className="h-3.5 w-3.5 text-[#71717a] shrink-0" />
              )}
              <span className={`text-xs font-semibold leading-5 ${
                msg.type === 'result' ? 'text-emerald-700' : msg.type === 'cancelled' ? 'text-[#52525b]' : 'text-[#111111]'
              }`}>
                {msg.stageLabel}
              </span>
              {false && (
                <button
                  type="button"
                  onClick={onStopGenerate}
                  className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#d4d4d8] bg-[#fafafa] px-2 py-1 text-[10px] font-bold text-[#52525b] transition-colors hover:bg-[#f4f4f5] hover:text-[#18181b]"
                >
                  <Square className="h-2.5 w-2.5 fill-current" />
                  중단
                </button>
              )}
            </div>

            {(msg.referenceImagePreviews?.length ?? 0) > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
                className="rounded-[18px] border border-white/70 bg-white/46 p-2.5 shadow-[0_10px_24px_rgba(79,70,229,0.10)] backdrop-blur-xl"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#4f46e5]">Reference images</p>
                  <span className="text-[10px] font-bold text-[#3730a3]">영상 장면에 반영</span>
                </div>
                <div className="flex gap-2">
                  {msg.referenceImagePreviews!.map((preview, index) => (
                    <div key={`${preview}-${index}`} className="relative h-14 w-14 overflow-hidden rounded-lg border border-white bg-white shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview} alt="" className="h-full w-full object-cover" />
                      <span className="absolute left-1 top-1 rounded bg-black/65 px-1 text-[8px] font-black text-white">
                        image{index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Draft card news mockups */}
            {(msg.draftSlides?.length ?? 0) > 0 && msg.type === 'progress' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.19, 1, 0.22, 1] }}
                className="border-t border-[#edf1f5] pt-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#6b7280]">Draft storyboard</p>
                  <span className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-[10px] font-bold text-[#4f46e5]">
                    {msg.draftSlides!.length} cards
                  </span>
                </div>
                <div className="overflow-x-auto pb-1">
                  <AnimatePresence initial={false}>
                    <div className="flex min-w-0 gap-2.5">
                      {msg.draftSlides!.map((slide, index) => (
                        <DraftSlideMockup
                          key={slide.slideNumber}
                          slide={slide}
                          index={index}
                          total={msg.draftSlides!.length}
                          referenceImagePreview={
                            msg.referenceImagePreviews?.length
                              ? msg.referenceImagePreviews[index % msg.referenceImagePreviews.length]
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {/* Slide progress */}
            {(msg.slideProgress?.length ?? 0) > 0 && (
              <div className="space-y-1.5 border-t border-[#e5e7eb] pt-2.5">
                {(msg.slideProgress ?? []).map(sp => (
                  <SlideProgressRow key={sp.slideNumber} sp={sp} />
                ))}
              </div>
            )}

            {msg.type === 'result' && msg.slides && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
                className="border-t border-[#edf1f5] pt-2.5"
              >
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-emerald-800">
                      {msg.slides.filter(s => s.videoUrl).length}개 영상 완성
                      {(msg.partialFailures ?? 0) > 0 && (
                        <span className="ml-1.5 text-orange-500">({msg.partialFailures}개 실패)</span>
                      )}
                    </p>
                    <p className="text-[10px] text-emerald-600 mt-0.5 flex items-center gap-1">
                      <ArrowRight className="h-2.5 w-2.5" />
                      편집 화면으로 이동 중...
                    </p>
                  </div>
                  <Loader2 className="h-3.5 w-3.5 text-emerald-400 animate-spin shrink-0" />
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function DraftSlideMockup({
  slide,
  index,
  total,
  referenceImagePreview,
}: {
  slide: DraftVideoSlide
  index: number
  total: number
  referenceImagePreview?: string
}) {
  const roleLabel = ROLE_LABEL[slide.role] ?? slide.role
  const basis = total <= 3 ? '30%' : total <= 5 ? '22%' : '17%'
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.42, delay: index * 0.06, ease: [0.19, 1, 0.22, 1] }}
      style={{ flex: `0 0 ${basis}`, minWidth: total <= 3 ? 132 : 112 }}
      className="overflow-hidden rounded-[18px] border border-[#d4d4d8] bg-white shadow-[0_14px_34px_rgba(24,24,27,0.08)]"
    >
      <div className="aspect-[9/12] bg-[#27272a] p-2">
        <div className="flex h-full flex-col overflow-hidden rounded-lg bg-white">
          <div className="relative h-[45%] bg-gradient-to-br from-[#f4f4f5] via-[#e4e4e7] to-[#a1a1aa]">
            {referenceImagePreview && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={referenceImagePreview} alt="" className="absolute inset-0 h-full w-full object-cover grayscale" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-white/10" />
              </>
            )}
            <div className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-[#3f3f46]">
              {roleLabel}
            </div>
            <div className="absolute inset-x-3 bottom-3 h-1.5 rounded-full bg-white/70" />
            <div className="absolute bottom-5 left-3 h-1.5 w-1/2 rounded-full bg-white/45" />
          </div>
          <div className="flex flex-1 flex-col justify-between bg-[#18181b] p-2.5 text-white">
            <div>
              <p className="text-[9px] font-black text-[#a1a1aa]">CARD {slide.slideNumber}</p>
              <p className="mt-1.5 text-[12px] font-black leading-4 text-white line-clamp-2">{slide.headline}</p>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-[#d4d4d8] line-clamp-3">{slide.body}</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function SlideProgressRow({ sp }: { sp: SlideProgress }) {
  const icons = {
    waiting: <div className="h-3 w-3 rounded-full border-2 border-[#d1d5db]" />,
    generating: <Loader2 className="h-3 w-3 text-[#4252ff] animate-spin" />,
    done: <Check className="h-3 w-3 text-emerald-500" />,
    error: <AlertCircle className="h-3 w-3 text-red-400" />,
  }[sp.status]

  const textColor = {
    waiting: 'text-[#9ca3af]',
    generating: 'text-[#4252ff]',
    done: 'text-emerald-600',
    error: 'text-red-500',
  }[sp.status]

  const barWidth = {
    waiting: '0%',
    generating: sp.elapsed ? `${Math.min(95, (sp.elapsed / 90) * 100)}%` : '5%',
    done: '100%',
    error: '100%',
  }[sp.status]

  const barColor = {
    waiting: 'bg-[#e5e7eb]',
    generating: 'bg-[#4252ff]',
    done: 'bg-emerald-400',
    error: 'bg-red-400',
  }[sp.status]

  return (
    <div className={`space-y-1 text-[11px] ${textColor}`}>
      <div className="flex items-center gap-2">
        <div className="shrink-0">{icons}</div>
        <span className="font-semibold">슬라이드 {sp.slideNumber}</span>
        {sp.status === 'generating' && sp.elapsed !== undefined && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-[#6b7280]">
            <Clock className="h-2.5 w-2.5" />{sp.elapsed}초
          </span>
        )}
        {sp.status === 'done' && <span className="ml-auto text-[10px] text-emerald-500 font-bold">완료</span>}
        {sp.status === 'error' && <span className="ml-auto text-[9px] text-red-400 truncate max-w-[140px]">{sp.error}</span>}
      </div>
      <div className="h-0.5 w-full rounded-full bg-[#e5e7eb] overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: '0%' }}
          animate={{ width: barWidth }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

const ROLE_LABEL: Record<string, string> = {
  hook: 'HOOK',
  context: 'CONTEXT',
  'key-point': 'KEY POINT',
  detail: 'DETAIL',
  stat: 'STAT',
  summary: 'SUMMARY',
  'save-cta': 'CTA',
}
