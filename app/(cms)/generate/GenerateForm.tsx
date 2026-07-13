'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useLocale, useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ImagePlus,
  Sparkles,
  Send,
  X,
  Sparkle,
  ChevronLeft,
  Check,
  Loader2,
  CreditCard,
  ChevronRight,
  GripVertical,
  Pencil,
  Palette,
} from 'lucide-react'
import { analytics, timeEvent } from '../../../lib/analytics/thinkingdata'

const StoryboardStage3D = dynamic(() => import('./StoryboardStage3D'), {
  ssr: false,
  loading: () => <div className="h-[580px] w-full animate-pulse bg-[#0b101a] sm:h-[720px]" aria-hidden="true" />,
})

interface Brand {
  id: string
  name: string
  industry: string
  targetAudience: string
  toneOfVoice: string
  mainColor: string
  forbiddenWords: string
  ctaStyle: string
  brandDna?: string | null
  websiteUrl?: string | null
}

interface GenerateFormProps {
  brand: Brand
  userId?: string
  userEmail?: string | null
  userName?: string | null
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
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
  variant?: 'question' | 'refinement'
}

interface DisplayMessage {
  id: string
  role: 'ai' | 'user'
  content: string
  revealedContent: string
  isTyping: boolean
  clarification?: ClarificationPrompt
  params?: GenerateParams
}

interface GenerateParams {
  topic: string
  visualHint: string
  contentType: string
  objective: string
  slideCount: number
  productUrl?: string | null
  brandAnalysis?: string
  targetEmotion?: string
  hookDirection?: string
  recommendedCta?: string
  reasonForStyle?: string
  structurePreview?: { slideNumber: number; role: string; description: string }[]
  draftSlides?: {
    slideNumber: number
    role: string
    headline: string
    body: string
    reasoning: string
  }[]
  refinementOptions?: ClarificationOption[]
}

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  const text = await response.text()
  if (!text.trim()) return null

  try {
    return JSON.parse(text) as T
  } catch (error) {
    console.warn('[GenerateForm] Non-JSON response received', {
      status: response.status,
      contentType: response.headers.get('content-type'),
      preview: text.slice(0, 180),
      error,
    })
    return null
  }
}

interface CopyPreviewSlide {
  slideNumber: number
  role: string
  headline: string
  body: string
}

const NEW_TOPIC_OPTION_VALUE = '__SHUFFLA_NEW_TOPIC__'
const DISABLE_INITIAL_GREETING = true

function truncateOptionLabel(label: string, locale: string) {
  const max = locale === 'en' ? 30 : 18
  const clean = label.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

function buildAgentMemoryContext(params?: GenerateParams) {
  if (!params?.draftSlides?.length) return ''

  const lines = [
    '',
    '[Existing draft slides]',
    `Topic: ${params.topic}`,
    `Slide count: ${params.slideCount}`,
    ...params.draftSlides.slice(0, 10).map(slide => (
      `${slide.slideNumber}. [${slide.role}] ${slide.headline} / ${slide.body}`
    )),
  ]

  return lines.join('\n')
}

function stripAgentMemoryContext(content: string) {
  return content.replace(/\n?\[Existing draft slides\][\s\S]*$/u, '')
}

function buildDraftRefinementPrompt(locale: string, options?: ClarificationOption[]): ClarificationPrompt {
  const isEn = locale === 'en'
  const dynamicOptions = Array.isArray(options)
    ? options
      .filter(option => option.label?.trim() && option.value?.trim())
      .map(option => ({ ...option, label: truncateOptionLabel(option.label, locale) }))
      .slice(0, 3)
    : []

  return {
    variant: 'refinement',
    question: isEn ? 'How should we tune this draft?' : '이 초안을 어떤 방향으로 조정할까요?',
    allowCustom: true,
    options: [
      ...(dynamicOptions.length >= 2 ? dynamicOptions : (isEn ? [
      { label: 'Make it easier', value: 'Revise the draft to explain the topic more simply and clearly. Do not run new research.' },
      { label: 'More trend-led', value: 'Revise the draft around trend signals and why people are reacting now. Do not run new research.' },
      { label: 'Stronger hook', value: 'Make the opening hook and slide headlines sharper while keeping the same facts. Do not run new research.' },
    ] : [
      { label: '더 쉽게 설명', value: '새 조사는 하지 말고, 현재 근거와 초안을 바탕으로 더 쉽고 명확한 정보형 흐름으로 다듬어 주세요.' },
      { label: '더 트렌디하게', value: '새 조사는 하지 말고, 현재 근거와 초안을 바탕으로 사람들이 왜 반응하는지 중심의 트렌드형 흐름으로 다듬어 주세요.' },
      { label: '훅 더 강하게', value: '새 조사는 하지 말고, 현재 근거와 초안을 바탕으로 첫 장 훅과 제목을 더 강하게 다듬어 주세요.' },
    ])),
    ],
  }
}

let msgCounter = 0
function mkId() { return `m-${++msgCounter}` }

function aiDisplay(content: string, clarification?: ClarificationPrompt, params?: GenerateParams): DisplayMessage {
  return { id: mkId(), role: 'ai', content, revealedContent: '', isTyping: true, clarification, params }
}

function userDisplay(content: string): DisplayMessage {
  return { id: mkId(), role: 'user', content, revealedContent: content, isTyping: false }
}

function getUserDisplayTextFromHistory(content: string, locale: string) {
  const newTopicPrefix = locale === 'en' ? 'New topic: ' : '새 주제로 전환: '
  return content.startsWith(newTopicPrefix) ? content.slice(newTopicPrefix.length) : content
}

function buildCardCopyContext(params: GenerateParams) {
  const lines = [
    `주제: ${params.topic}`,
    `콘텐츠 방향: ${params.contentType}`,
    `기획 목표: ${params.objective}`,
  ]

  if (params.hookDirection) lines.push(`훅 방향: ${params.hookDirection}`)
  if (params.brandAnalysis) lines.push(`브랜드 해석: ${params.brandAnalysis}`)
  if (params.recommendedCta) lines.push(`권장 행동: ${params.recommendedCta}`)
  if (params.structurePreview?.length) {
    lines.push('슬라이드별 기획 흐름:')
    params.structurePreview.forEach(slide => {
      lines.push(`${slide.slideNumber}. ${slide.role}: ${slide.description}`)
    })
  }

  return lines.join('\n')
}

// Custom smooth cubic bezier for high-end feel
const smoothTransition = { duration: 0.75, ease: [0.19, 1, 0.22, 1] as const }



const formContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05
    }
  }
}

const formItemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1] as const
    }
  }
}

export default function GenerateForm({
  brand,
}: GenerateFormProps) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('generate')
  const language = locale === 'en' ? 'en' : 'ko'

  const LOADING_STEPS = [
    t('loading_step1'),
    t('loading_step2'),
    t('loading_step3'),
    t('loading_step4'),
    t('loading_step5'),
  ]
  const loadingStepCount = LOADING_STEPS.length

  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([])
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isWaiting, setIsWaiting] = useState(false)
  const [isRevealingMessage, setIsRevealingMessage] = useState(false)
  const [readyParams, setReadyParams] = useState<GenerateParams | null>(null)
  const [, setBriefingStage] = useState(0)
  const [phase, setPhase] = useState<'chat' | 'preview' | 'generating'>('chat')
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [referenceFiles, setReferenceFiles] = useState<File[]>([])
  const [copyPreviewSlides, setCopyPreviewSlides] = useState<CopyPreviewSlide[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [pendingNewTopic, setPendingNewTopic] = useState(false)
  const [selectedSlideCount, setSelectedSlideCount] = useState<3 | 5 | 7>(5)

  // Promo payment modal states
  const [showPromoModal, setShowPromoModal] = useState(false)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [thinkingSteps, setThinkingSteps] = useState<Array<{ step: string; text: string }>>([])

  const generating = phase === 'generating'

  const generationMode = brand.websiteUrl === 'general_profile' ? 'general' : 'brand'
  const shouldShowHero = !isWaiting && displayMessages.length === 0 && !readyParams && !isRevealingMessage

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const typingTimerRef = useRef<number | null>(null)
  const briefingTimersRef = useRef<number[]>([])
  const generationStartedAtRef = useRef<number | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!displayMessages.some(message => message.role === 'user')) return
    const timer = window.setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [displayMessages])

  useEffect(() => {
    const displayedUserCount = displayMessages.filter(message => message.role === 'user').length
    const historyUserMessages = chatHistory.filter(message => message.role === 'user')
    if (historyUserMessages.length <= displayedUserCount) return

    const missingMessages = historyUserMessages
      .slice(displayedUserCount)
      .map(message => userDisplay(getUserDisplayTextFromHistory(message.content, locale)))

    const timer = window.setTimeout(() => {
      setDisplayMessages(prev => [...prev, ...missingMessages])
    }, 0)
    return () => window.clearTimeout(timer)
  }, [chatHistory, displayMessages, locale])

  useEffect(() => {
    if (!generating) return
    loadingIntervalRef.current = setInterval(() => {
      setLoadingStep(prev => (prev < loadingStepCount - 1 ? prev + 1 : prev))
    }, 4000)
    return () => { if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current) }
  }, [generating, loadingStepCount])

  const clearTypingTimer = useCallback(() => {
    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current)
      typingTimerRef.current = null
    }
  }, [])

  const clearBriefingTimers = useCallback(() => {
    briefingTimersRef.current.forEach(timer => window.clearTimeout(timer))
    briefingTimersRef.current = []
  }, [])

  const addFiles = useCallback((incoming: File[]) => {
    const imageFiles = incoming.filter(f => f.type.startsWith('image/'))
    if (!imageFiles.length) return
    setReferenceFiles(current => {
      const merged = [...current, ...imageFiles]
      if (merged.length > 4) {
        setError(t('error_max_images'))
        return current
      }
      setError(null)
      if (imageFiles.length > 0) {
        analytics.productImageAdd(imageFiles.length, {
          upload_source: 'file_or_paste',
          generation_mode: generationMode,
          brand_id: brand.id,
        })
      }
      return merged
    })
  }, [brand.id, generationMode, t])

  const revealBriefing = useCallback((params?: GenerateParams) => {
    clearBriefingTimers()
    if (!params) return

    setReadyParams(params)
    setBriefingStage(1)
    briefingTimersRef.current = [
      window.setTimeout(() => setBriefingStage(2), 420),
      window.setTimeout(() => setBriefingStage(3), 900),
    ]
  }, [clearBriefingTimers])

  const appendAiMessage = useCallback((content: string, params?: GenerateParams, clarification?: ClarificationPrompt) => {
    clearTypingTimer()
    const message = aiDisplay(content, clarification, params)
    let cursor = 0

    setDisplayMessages(prev => [...prev, message])
    setIsRevealingMessage(true)

    const revealNext = () => {
      const step = content.length > 220 ? 3 : 2
      cursor = Math.min(content.length, cursor + step)

      setDisplayMessages(prev => prev.map(item => (
        item.id === message.id
          ? { ...item, revealedContent: content.slice(0, cursor), isTyping: cursor < content.length }
          : item
      )))

      if (cursor < content.length) {
        const lastChar = content[cursor - 1]
        const delay = /[.!?。！？\n]/.test(lastChar) ? 90 : 18
        typingTimerRef.current = window.setTimeout(revealNext, delay)
        return
      }

      typingTimerRef.current = null
      setIsRevealingMessage(false)
      revealBriefing(params)
      window.setTimeout(() => inputRef.current?.focus(), 50)
    }

    typingTimerRef.current = window.setTimeout(revealNext, 100)
  }, [clearTypingTimer, revealBriefing])

  const dismissClarification = useCallback((messageId: string) => {
    setDisplayMessages(prev => prev.map(message => (
      message.id === messageId ? { ...message, clarification: undefined } : message
    )))
  }, [])

  const updateStoryboard = useCallback((messageId: string, params: GenerateParams) => {
    setDisplayMessages(prev => prev.map(message => (
      message.id === messageId ? { ...message, params } : message
    )))
    setReadyParams(params)
  }, [])

  useEffect(() => () => {
    clearTypingTimer()
    clearBriefingTimers()
  }, [clearBriefingTimers, clearTypingTimer])

  // Global paste listener — catches Ctrl+V / Cmd+V anywhere on the page
  useEffect(() => {
    if (!readyParams) return

    // Primary: DOM paste event (works when document has focus after interaction)
    const pasteHandler = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? [])
      const files = items
        .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
        .map(item => item.getAsFile())
        .filter((f): f is File => f !== null)
      if (files.length > 0) {
        e.preventDefault()
        addFiles(files)
      }
    }

    // Fallback: keydown Ctrl/Cmd+V → navigator.clipboard.read() for cases where
    // paste event is suppressed (e.g. focus on non-editable element)
    const keyHandler = async (e: KeyboardEvent) => {
      if (!((e.ctrlKey || e.metaKey) && e.key === 'v')) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      try {
        const items = await navigator.clipboard.read()
        for (const item of items) {
          const imageType = item.types.find(t => t.startsWith('image/'))
          if (imageType) {
            const blob = await item.getType(imageType)
            const file = new File([blob], `pasted-${Date.now()}.${imageType.split('/')[1] || 'png'}`, { type: imageType })
            addFiles([file])
            break
          }
        }
      } catch {
        // clipboard-read permission denied or no image — ignore
      }
    }

    window.addEventListener('paste', pasteHandler)
    window.addEventListener('keydown', keyHandler)
    return () => {
      window.removeEventListener('paste', pasteHandler)
      window.removeEventListener('keydown', keyHandler)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyParams])

  const handleCancelAgent = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setIsWaiting(false)
    clearTypingTimer()
    appendAiMessage(locale === 'en' ? 'Request cancelled.' : '요청이 취소되었습니다.')
  }, [clearTypingTimer, appendAiMessage, locale])

  const callAgent = useCallback(async (history: ChatMessage[]) => {
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsWaiting(true)
    setThinkingSteps([])
    try {
      const res = await fetch('/api/agents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, brandId: brand.id, language, generationMode, slideCount: selectedSlideCount }),
        signal: controller.signal,
      })

      // SSE stream parsing
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let data: { message?: string; ready?: boolean; params?: GenerateParams; clarification?: ClarificationPrompt; error?: string } | null = null

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const parts = buffer.split('\n\n')
          buffer = parts.pop() ?? ''

          for (const part of parts) {
            const eventMatch = part.match(/^event: (\w+)\ndata: ([\s\S]+)$/)
            if (!eventMatch) continue
            const [, event, rawData] = eventMatch
            try {
              const parsed = JSON.parse(rawData)
              if (event === 'think') {
                setThinkingSteps(prev => [...prev, { step: parsed.step, text: parsed.text }])
              } else if (event === 'message') {
                data = parsed
              }
            } catch { /* ignore parse errors */ }
          }
        }

        if (!data) {
          appendAiMessage(locale === 'en' ? 'An error occurred. Please try again.' : '요청을 처리하는 중 오류가 발생했습니다.')
          return
        }

        // Process final message data (same as before)
        if (data.error) {
          appendAiMessage(locale === 'en' ? 'An error occurred while processing your request. Please try again.' : '요청을 처리하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
          return
        }

        const msg = data.message || (locale === 'en' ? 'Please try again.' : '다시 시도해주세요.')
        const refinementPrompt = data.ready && data.params?.draftSlides?.length
          ? buildDraftRefinementPrompt(locale, data.params.refinementOptions)
          : undefined
        appendAiMessage(msg, data.params ? data.params : undefined, refinementPrompt || (!data.ready ? data.clarification : undefined))
        if (data.ready && data.params) {
          analytics.generateBriefReady({ brandId: brand.id, generationMode, topic: data.params.topic, contentType: data.params.contentType, objective: data.params.objective, slideCount: data.params.slideCount, hasProductUrl: Boolean(data.params.productUrl), structureSlideCount: data.params.structurePreview?.length ?? 0, locale })
        }
        const clarificationContext = data.clarification ? ['\n', `[Clarification question shown to user] ${data.clarification.question}`, '[Clarification options]', ...data.clarification.options.map(o => `- ${o.label}: ${o.value}`)].join('\n') : ''
        const draftContext = buildAgentMemoryContext(data.params)
        setChatHistory(prev => [...prev, { role: 'assistant', content: `${msg}${clarificationContext}${draftContext}` }])

      } else {
        // Fallback: plain JSON response (e.g. greeting)
        const data2 = await readJsonResponse<{ message?: string; ready?: boolean; params?: GenerateParams; clarification?: ClarificationPrompt; error?: string }>(res)
        if (!res.ok || !data2 || data2.error) {
          appendAiMessage(locale === 'en' ? 'An error occurred while processing your request. Please try again.' : '요청을 처리하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
          return
        }
        const msg2 = data2.message || (locale === 'en' ? 'Please try again.' : '다시 시도해주세요.')
        const refinementPrompt2 = data2.ready && data2.params?.draftSlides?.length ? buildDraftRefinementPrompt(locale, data2.params.refinementOptions) : undefined
        appendAiMessage(msg2, data2.params ? data2.params : undefined, refinementPrompt2 || (!data2.ready ? data2.clarification : undefined))
        const clarificationContext2 = data2.clarification ? ['\n', `[Clarification question shown to user] ${data2.clarification.question}`, '[Clarification options]', ...data2.clarification.options.map(o => `- ${o.label}: ${o.value}`)].join('\n') : ''
        const draftContext2 = buildAgentMemoryContext(data2.params)
        setChatHistory(prev => [...prev, { role: 'assistant', content: `${msg2}${clarificationContext2}${draftContext2}` }])
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      appendAiMessage(locale === 'en' ? 'Failed to connect to server. Please try again.' : '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null
      setIsWaiting(false)
      setThinkingSteps([])
    }
  }, [appendAiMessage, brand.id, generationMode, locale, language, selectedSlideCount])

  // Load the initial Agent greeting (Brand Mode only)
  useEffect(() => {
    if (generationMode !== 'brand' || DISABLE_INITIAL_GREETING) return
    let active = true
    const loadGreeting = async () => {
      try {
        const res = await fetch('/api/agents/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [], brandId: brand.id, language, generationMode, slideCount: selectedSlideCount }),
        })
        const data = await readJsonResponse<{ message?: string; error?: string }>(res)
        if (!active) return
        const msg = (!res.ok || !data || data.error) ? (locale === 'en' ? 'An error occurred. Please try again.' : '오류가 발생했습니다. 다시 시도해주세요.') : (data.message || (locale === 'en' ? 'Please try again.' : '다시 시도해주세요.'))
        appendAiMessage(msg)
        setChatHistory([{ role: 'assistant', content: msg }])
      } catch {
        if (active) appendAiMessage(locale === 'en' ? 'Failed to connect to server. Please try again.' : '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.')
      } finally {
        if (active) setIsWaiting(false)
      }
    }
    void loadGreeting()
    return () => { active = false }
  }, [generationMode, appendAiMessage, brand.id, language, locale, selectedSlideCount])

  // Automated General Mode Briefing: greet and let the user enter a topic.
  // RSS is fetched server-side when the agent processes the user's message.
  // General Mode: show greeting and wait for user to enter a topic.
  // The agent route handles RSS fetching server-side when processing messages.
  useEffect(() => {
    if (generationMode !== 'general' || DISABLE_INITIAL_GREETING) return

    let active = true
    const greet = async () => {
      setIsWaiting(true)

      const greeting = locale === 'en'
        ? `Hello! Let's create your card news.\n\nPlease enter the topic or keyword you want to cover (e.g. "walnut health benefits", "AI trends this week"). I'll plan the best card news structure for you.`
        : `안녕하세요! 카드뉴스 기획을 시작합니다.\n\n오늘 다루고 싶은 주제나 키워드를 입력해 주세요. (예: "호두 건강 효과", "이번 주 AI 트렌드") 최신 뉴스와 결합해서 가장 효과적인 카드뉴스 구성을 바로 제안해 드리겠습니다.`

      if (!active) return
      appendAiMessage(greeting)
      setChatHistory([{ role: 'assistant', content: greeting }])
      setIsWaiting(false)
    }

    const timer = setTimeout(() => { void greet() }, 150)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [generationMode, locale, appendAiMessage])

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || isWaiting || isRevealingMessage) return

    const userMsg: ChatMessage = {
      role: 'user',
      content: pendingNewTopic
        ? (locale === 'en' ? `New topic: ${text}` : `새 주제로 전환: ${text}`)
        : (locale === 'en'
          ? `[Selected slide count: ${selectedSlideCount}]\n${text}`
          : `[선택한 카드뉴스 장수: ${selectedSlideCount}장]\n${text}`),
    }
    const baseHistory = pendingNewTopic
      ? chatHistory.map(message => (
        message.role === 'assistant'
          ? { ...message, content: stripAgentMemoryContext(message.content) }
          : message
      ))
      : chatHistory
    const newHistory = [...baseHistory, userMsg]

    flushSync(() => {
      setDisplayMessages(prev => [...prev, userDisplay(text)])
    })
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setChatHistory(newHistory)
    analytics.generateAgentMessageSend({
      brandId: brand.id,
      generationMode,
      messageLength: text.length,
      chatTurnIndex: chatHistory.filter(message => message.role === 'user').length + 1,
      locale,
    })
    setInput('')
    setPendingNewTopic(false)
    setReadyParams(null)
    setBriefingStage(0)
    clearBriefingTimers()

    await callAgent(newHistory)
  }

  const handleClarificationSelect = async (option: ClarificationOption | null) => {
    if (isWaiting || isRevealingMessage) return

    if (option?.value === NEW_TOPIC_OPTION_VALUE) {
      const userLabel = option.label
      const prompt = locale === 'en'
        ? 'Okay. Type the new topic below and I will research it from scratch.'
        : '좋아요. 아래 입력창에 새 주제를 입력하면 이전 초안과 분리해서 다시 조사할게요.'

      flushSync(() => {
        setDisplayMessages(prev => [
          ...prev.map(message => (
            message.clarification?.variant === 'refinement'
              ? { ...message, clarification: undefined }
              : message
          )),
          userDisplay(userLabel),
        ])
      })
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      appendAiMessage(prompt)
      setChatHistory([{ role: 'assistant', content: prompt }])
      setReadyParams(null)
      setBriefingStage(0)
      setPendingNewTopic(true)
      setInput('')
      clearBriefingTimers()
      window.setTimeout(() => inputRef.current?.focus(), 50)
      return
    }

    const text = option
      ? option.value
      : (locale === 'en'
        ? 'Proceed with the current information and choose the best concrete direction yourself.'
        : '현재 정보만으로 가장 적절한 구체 방향을 선택해서 진행해 주세요.')
    const userLabel = option?.label || (locale === 'en' ? 'Use current info' : '현재 정보로 진행')
    const userMsg: ChatMessage = { role: 'user', content: text }
    const newHistory = [...chatHistory, userMsg]

    flushSync(() => {
      setDisplayMessages(prev => [...prev, userDisplay(userLabel)])
    })
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setChatHistory(newHistory)
    analytics.generateAgentMessageSend({
      brandId: brand.id,
      generationMode,
      messageLength: text.length,
      chatTurnIndex: chatHistory.filter(message => message.role === 'user').length + 1,
      locale,
    })
    setInput('')
    setReadyParams(null)
    setBriefingStage(0)
    clearBriefingTimers()

    await callAgent(newHistory)
  }

  const handleCopyPreview = async () => {
    if (!readyParams) return
    
    // 대화 중에 카피 초안(draftSlides)이 이미 합의되었다면 서버 요청 없이 즉시 전환
    if (readyParams.draftSlides && readyParams.draftSlides.length > 0) {
      setCopyPreviewSlides(readyParams.draftSlides.map(slide => ({
        slideNumber: slide.slideNumber,
        role: slide.role,
        headline: slide.headline,
        body: slide.body
      })))
      setPhase('preview')
      return
    }

    setPreviewLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/campaigns/copy-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: brand.id,
          topic: readyParams.topic,
          category: brand.industry,
          title: language === 'en' ? `${readyParams.topic} Card News` : `${readyParams.topic} 카드뉴스`,
          keyContent: buildCardCopyContext(readyParams),
          tone: brand.toneOfVoice || (language === 'en' ? 'warm and emotional' : '감성적이고 따뜻하게'),
          contentType: readyParams.contentType,
          objective: readyParams.objective,
          slideCount: readyParams.slideCount,
          productUrl: readyParams.productUrl || undefined,
          visualHint: readyParams.visualHint,
          brandAnalysis: readyParams.brandAnalysis,
          targetEmotion: readyParams.targetEmotion,
          hookDirection: readyParams.hookDirection,
          recommendedCta: readyParams.recommendedCta,
          reasonForStyle: readyParams.reasonForStyle,
          structurePreview: readyParams.structurePreview,
          language,
          generationMode,
        }),
      })
      const data = await res.json() as { slides?: CopyPreviewSlide[]; error?: string }
      if (!res.ok || data.error || !data.slides) {
        setError(data.error || t('copy_preview_error'))
        return
      }
      setCopyPreviewSlides(data.slides)
      setPhase('preview')
    } catch {
      setError(t('copy_preview_error'))
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleGenerate = async (confirmedSlides?: CopyPreviewSlide[]) => {
    if (!readyParams) return
    setLoadingStep(0)
    setPhase('generating')
    setError(null)
    generationStartedAtRef.current = Date.now()

    timeEvent('generate_complete')
    analytics.generateStart({
      brandId: brand.id,
      generationMode,
      slideCount: readyParams.slideCount,
      platform: 'card_news',
      intent: readyParams.objective,
      topic: readyParams.topic,
      contentType: readyParams.contentType,
      hasProductUrl: Boolean(readyParams.productUrl),
      imageCount: referenceFiles.length,
    })

    try {
      let productImageUrls: string[] = []
      if (referenceFiles.length > 0) {
        const formData = new FormData()
        referenceFiles.forEach(file => formData.append('files', file))
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
        const uploadData = await uploadRes.json() as { urls?: string[]; error?: string }
        if (!uploadRes.ok || !uploadData.urls?.length) {
          setError(uploadData.error || t('error_upload'))
          setPhase('preview')
          return
        }
        productImageUrls = uploadData.urls
      }

      const res = await fetch('/api/campaigns/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignType: 'media',
          brandId: brand.id,
          topic: readyParams.topic,
          category: brand.industry,
          title: language === 'en' ? `${readyParams.topic} Card News` : `${readyParams.topic} 카드뉴스`,
          keyContent: buildCardCopyContext(readyParams),
          tone: brand.toneOfVoice || (language === 'en' ? 'warm and emotional' : '감성적이고 따뜻하게'),
          contentType: readyParams.contentType,
          slideCount: readyParams.slideCount,
          productUrl: readyParams.productUrl || undefined,
          visualHint: readyParams.visualHint,
          objective: readyParams.objective,
          brandAnalysis: readyParams.brandAnalysis,
          targetEmotion: readyParams.targetEmotion,
          hookDirection: readyParams.hookDirection,
          recommendedCta: readyParams.recommendedCta,
          reasonForStyle: readyParams.reasonForStyle,
          structurePreview: readyParams.structurePreview,
          confirmedSlides: confirmedSlides ?? readyParams.draftSlides?.map(s => ({
            slideNumber: s.slideNumber,
            role: s.role,
            headline: s.headline,
            body: s.body
          })) ?? undefined,
          productImageUrls,
          language,
          generationMode,
        }),
      })

      const data = await res.json() as { campaignId?: string; error?: string }
      if (!res.ok || data.error) {
        if (res.status === 429 && (data.error?.includes('무료 플랜') || data.error?.includes('최초 2회'))) {
          analytics.generateFailed(brand.id, data.error || 'quota_exceeded', {
            generation_mode: generationMode,
            http_status: res.status,
            slide_count: readyParams.slideCount,
          })
          setPhase('preview')
          setShowPromoModal(true)
          return
        }

        analytics.generateFailed(brand.id, data.error || 'api_error', {
          generation_mode: generationMode,
          http_status: res.status,
          slide_count: readyParams.slideCount,
        })
        setError(data.error || t('error_generate'))
        setPhase('preview')
        return
      }

      analytics.generateComplete({
        brandId: brand.id,
        campaignId: data.campaignId ?? '',
        generationMode,
        slideCount: readyParams.slideCount,
        durationMs: generationStartedAtRef.current ? Date.now() - generationStartedAtRef.current : 0,
      })
      router.push(`/campaign/${data.campaignId}`)
    } catch {
      analytics.generateFailed(brand.id, 'network_error', {
        generation_mode: generationMode,
        slide_count: readyParams.slideCount,
      })
      setError(t('error_network'))
      setPhase('preview')
    }
  }

  const selectReferenceFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    addFiles(files)
  }

  const handlePaste = (event: React.ClipboardEvent) => {
    const items = Array.from(event.clipboardData.items)
    const files = items
      .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter((f): f is File => f !== null)
    if (files.length > 0) {
      event.preventDefault()
      addFiles(files)
    }
  }

  const handleUpgradeCheckout = async (planKey: 'PRO' | 'UNLIMITED') => {
    setPromoError(null)
    setProcessingPayment(true)

    analytics.planSelectClick(planKey, 'FREE', { payment_provider: 'polar' })
    analytics.paymentStart(planKey, 'polar', {})

    try {
      const res = await fetch('/api/polar/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
      })
      const body = await res.json() as { url?: string; error?: string }
      if (!res.ok || !body.url) {
        analytics.paymentFailed(planKey, 'polar', body.error || 'checkout_error', {})
        setPromoError(body.error || '결제창을 열 수 없습니다. 다시 시도해 주세요.')
        setProcessingPayment(false)
        return
      }
      window.location.href = body.url
    } catch (err) {
      console.error('Polar checkout error:', err)
      setPromoError('결제 처리 중 네트워크 오류가 발생했습니다.')
      setProcessingPayment(false)
    }
  }

  // ── Copy Preview screen ─────────────────────────────────────────
  if (phase === 'preview') {
    return (
      <>
        <CopyPreviewPanel
          slides={copyPreviewSlides}
          referenceFiles={referenceFiles}
          setReferenceFiles={setReferenceFiles}
          error={error}
          onBack={() => { setPhase('chat'); setError(null) }}
          onConfirm={(slides) => handleGenerate(slides)}
          t={t}
          locale={locale}
        />
        {showPromoModal && (
          <PromoPaymentModal
            processing={processingPayment}
            error={promoError}
            onSelect={handleUpgradeCheckout}
            onClose={() => setShowPromoModal(false)}
          />
        )}
      </>
    )
  }

  // ── Generating overlay ──────────────────────────────────────────
  if (phase === 'generating') {
    const LOADING_STEP_TITLES = language === 'en' ? [
      "1. Brand Analysis",
      "2. Copy Writing",
      "3. Visual & Style Design",
      "4. Layout Calculation",
      "5. Quality Assurance"
    ] : [
      "1단계. 브랜드 분석 및 콘셉트 도출",
      "2단계. 카피 조율 및 마케팅 톤 설정",
      "3단계. 비주얼 방향 및 프롬프트 설계",
      "4단계. 레이아웃 & 타이포그래피 계산",
      "5단계. 모바일 가독성 및 최종 검수"
    ]

    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#f7f7f7] px-6 py-16 text-[#111111] relative overflow-hidden">
        {/* Glow ambient background bubbles */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-transparent blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-transparent blur-[100px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={smoothTransition}
          className="w-full max-w-lg bg-white border border-[#e5e7eb] rounded-2xl p-8 shadow-md relative z-10"
        >
          <div className="text-center mb-8">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              className="mb-4 inline-flex"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e293b] border border-[#e5e7eb] shadow-sm">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
            </motion.div>
            <h2 className="text-2xl font-black tracking-[-0.03em] text-[#111111]">{t('building_title')}</h2>
            <p className="mt-2 text-xs text-[#9ca3af] font-bold">{t('wait_msg')}</p>
          </div>

          {/* Timeline Blocks */}
          <div className="space-y-4 relative">
            {LOADING_STEPS.map((stepDesc, idx) => {
              const isCompleted = idx < loadingStep
              const isCurrent = idx === loadingStep

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1, duration: 0.4 }}
                  className={`relative flex gap-4 p-4 rounded-2xl border transition-all duration-300 ${
                    isCompleted
                      ? 'bg-emerald-50/40 border-emerald-100/70 text-emerald-800'
                      : isCurrent
                      ? 'bg-white border-2 border-[#3b82f6] shadow-sm text-[#111111]'
                      : 'bg-white border-[#e5e7eb] text-gray-400 opacity-55'
                  }`}
                >
                  {/* Timeline Connector Line */}
                  {idx < LOADING_STEPS.length - 1 && (
                    <div
                      aria-hidden="true"
                      className={`absolute left-7 top-full h-4 w-[2px] -translate-x-1/2 transition-colors duration-500 ${
                        isCompleted ? 'bg-emerald-400' : 'bg-[#e5e7eb]'
                      }`}
                    />
                  )}

                  {/* Step Status Icon */}
                  <div className="relative z-10 shrink-0">
                    {isCompleted ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_2px_8px_rgba(16,185,129,0.2)]">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </div>
                    ) : isCurrent ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#3b82f6] text-white shadow-sm">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      </div>
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 border border-gray-200 text-gray-400 text-xs font-bold">
                        {idx + 1}
                      </div>
                    )}
                  </div>

                  {/* Step Description */}
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-black tracking-[-0.02em] ${
                      isCompleted ? 'text-emerald-900' : isCurrent ? 'text-[#111111]' : 'text-gray-400'
                    }`}>
                      {LOADING_STEP_TITLES[idx]}
                    </h4>
                    <p className={`mt-1.5 text-xs leading-5 font-semibold ${
                      isCompleted ? 'text-emerald-700/80' : isCurrent ? 'text-[#6b7280]' : 'text-gray-400/70'
                    }`}>
                      {stepDesc}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Main layout ─────────────────────────────────────────────────
  return (
    <motion.div
      variants={formContainerVariants}
      initial="hidden"
      animate="visible"
      className="flex h-full overflow-hidden bg-white"
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #d1d5db;
        }
        .shuffla-ambient-gradient {
          background:
            radial-gradient(circle at 18% 18%, rgba(207, 216, 255, 0.22), transparent 36%),
            radial-gradient(circle at 76% 12%, rgba(245, 248, 255, 0.62), transparent 38%),
            radial-gradient(circle at 52% 42%, rgba(215, 238, 255, 0.24), transparent 36%),
            radial-gradient(circle at 82% 74%, rgba(196, 224, 255, 0.22), transparent 40%),
            radial-gradient(circle at 20% 88%, rgba(188, 205, 255, 0.18), transparent 44%),
            linear-gradient(180deg, #fbfdff 0%, #f8fbff 56%, #f4f8ff 100%);
          background-size: 135% 135%;
          animation: shufflaAmbientDrift 26s ease-in-out infinite alternate;
        }
        .shuffla-ambient-gradient::after {
          content: "";
          position: absolute;
          inset: -18%;
          background:
            radial-gradient(circle at 44% 20%, rgba(255, 255, 245, 0.22), transparent 20%),
            radial-gradient(circle at 70% 92%, rgba(158, 184, 255, 0.14), transparent 30%);
          filter: blur(34px);
          animation: shufflaAmbientFloat 34s ease-in-out infinite alternate;
        }
        @keyframes shufflaAmbientDrift {
          0% { background-position: 0% 0%; transform: scale(1); }
          50% { background-position: 58% 38%; transform: scale(1.025); }
          100% { background-position: 100% 84%; transform: scale(1.045); }
        }
        @keyframes shufflaAmbientFloat {
          0% { transform: translate3d(-2%, -1%, 0) rotate(0deg); opacity: 0.42; }
          100% { transform: translate3d(3%, 2%, 0) rotate(3deg); opacity: 0.58; }
        }
      ` }} />

      {/* Chat panel */}
      <motion.div
        variants={formItemVariants}
        className="relative isolate flex min-w-0 flex-1 flex-col overflow-hidden bg-[#fbfdff]"
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 shuffla-ambient-gradient" />
        {/* Header containing Brand chip & Mode Label */}
        <div className="relative z-10 shrink-0 border-b border-white/60 bg-white/55 px-5 py-3 backdrop-blur-xl flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#111111]">
            <Sparkles className="h-3.5 w-3.5" />
            {locale === 'en' ? 'Image card news' : '이미지 카드뉴스'}
          </div>

          <div className="flex items-center gap-3 text-xs text-[#9ca3af]">
            <span>{generationMode === 'general' ? t('mode_general') : t('mode_brand')}</span>
            <span>{brand.name}</span>
          </div>
        </div>

        {shouldShowHero ? (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-8">
            <motion.div
              variants={formItemVariants}
              className="flex w-full max-w-[820px] flex-col items-center text-center"
            >
              <h1 className="text-[22px] font-black tracking-[-0.01em] text-[#111827] sm:text-[28px] md:text-[34px]">
                {locale === 'en' ? 'What image card news should we make?' : '어떤 이미지 카드뉴스를 만들까요?'}
              </h1>
              <p className="mt-3 max-w-[590px] text-sm font-medium leading-6 text-[#64748b]">
                {locale === 'en'
                  ? 'Enter a topic, target, and mood first. Shuffla will plan the hook, body copy, and visual direction.'
                  : '주제, 타깃, 분위기만 입력하면 후킹 제목, 본문, 비주얼 방향을 먼저 기획합니다.'}
              </p>

              <form onSubmit={handleSend} className="relative z-20 mt-6 w-full max-w-[760px]">
                <div className="relative z-20 rounded-[24px] border border-[#dfe7ff] bg-white/86 px-5 py-5 shadow-[0_24px_68px_rgba(79,70,229,0.13)] backdrop-blur-xl transition-all focus-within:border-[#c4b5fd] focus-within:bg-white/92 focus-within:shadow-[0_28px_82px_rgba(79,70,229,0.17)]">
                  <textarea
                    rows={4}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void handleSend()
                      }
                    }}
                    placeholder={locale === 'en'
                      ? 'Ex. A 5-slide card news that introduces our new sunscreen to office workers in their 20s'
                      : '예: 신제품 출시 소식을 20대 직장인에게 감각적으로 보여주는 5장 이미지 카드뉴스'}
                    disabled={isWaiting || isRevealingMessage}
                    className="min-h-[118px] w-full resize-none border-none bg-transparent px-0 text-[15px] leading-7 text-[#111111] outline-none placeholder-[#a8b0bd] disabled:opacity-50"
                    autoFocus
                  />

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <label
                        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#e5e7eb] bg-white text-[#64748b] transition-colors hover:border-[#cbd5e1] hover:text-[#334155]"
                        title={locale === 'en' ? 'Add reference image' : '참고 이미지 추가'}
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                        <input type="file" accept="image/*" multiple className="hidden" onChange={selectReferenceFiles} />
                      </label>
                      <div className="flex items-center gap-1 rounded-full border border-[#e5e7eb] bg-white/84 p-1">
                        {[3, 5, 7].map((count) => (
                          <button
                            key={count}
                            type="button"
                            onClick={() => setSelectedSlideCount(count as 3 | 5 | 7)}
                            aria-pressed={selectedSlideCount === count}
                            className={`flex h-6 min-w-7 items-center justify-center rounded-full px-2 text-[11px] font-bold ${
                              selectedSlideCount === count ? 'bg-[#4252ff] text-white' : 'text-[#64748b] hover:bg-[#f5f7ff] hover:text-[#3730a3]'
                            }`}
                          >
                            {count}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={!input.trim() || isWaiting || isRevealingMessage}
                      className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#4252ff] px-4 text-xs font-bold text-white shadow-[0_12px_28px_rgba(66,82,255,0.22)] transition-all hover:bg-[#3442e8] hover:shadow-[0_16px_34px_rgba(66,82,255,0.26)] disabled:opacity-30"
                    >
                      <Send className="h-4 w-4" />
                      {locale === 'en' ? 'Start' : '시작'}
                    </button>
                  </div>
                </div>
              </form>

              <ImageCardNewsHeroMockup />
            </motion.div>
          </div>
        ) : (
          <>
        {/* Messages */}
        <div className="relative z-10 flex-1 overflow-y-auto bg-transparent px-6 py-8 custom-scrollbar" aria-live="polite">
          <div className="mx-auto flex w-full max-w-[920px] flex-col gap-7">
          {/* Initial loading skeleton */}
          {displayMessages.length === 0 && isWaiting && (
            <div className="flex justify-start">
              <div className="flex flex-col gap-2.5 items-start">
                <span className="text-[11px] font-semibold text-[#6b7280] tracking-wide">Shuffla</span>
                <div className="rounded-xl rounded-tl-sm border border-white/65 bg-white/70 px-4 py-2.5 shadow-[0_14px_36px_rgba(87,119,185,0.10)] backdrop-blur-xl">
                  <div className="flex gap-1.5 py-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9ca3af]" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9ca3af]" style={{ animationDelay: '120ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9ca3af]" style={{ animationDelay: '240ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {displayMessages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 14, scale: 0.985, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -8, scale: 0.99 }}
                transition={{ duration: 0.64, ease: [0.19, 1, 0.22, 1] }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex max-w-[85%] flex-col gap-2.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.role === 'ai' && (
                    <span className="text-[11px] font-semibold text-[#6b7280] tracking-wide">Shuffla</span>
                  )}
                  <div
                    className={`rounded-[20px] border px-4 py-3 text-sm leading-6 font-medium whitespace-pre-line backdrop-blur-xl shadow-[0_16px_38px_rgba(87,119,185,0.12)] ${
                      msg.role === 'user'
                        ? 'rounded-tr-md border-[#c8d8ff] bg-white/62 text-[#26334a]'
                        : 'rounded-tl-md border-white/70 bg-white/72 text-[#111111]'
                    }`}
                  >
                    {msg.role === 'ai' ? msg.revealedContent : msg.content}
                    {msg.role === 'ai' && msg.isTyping && (
                      <span className="ml-0.5 inline-block h-[1em] w-px align-middle bg-[#9ca3af] animate-pulse" />
                    )}
                  </div>
                  {msg.role === 'ai' && !msg.isTyping && (msg.params?.draftSlides?.length || msg.params?.structurePreview?.length) && (
                    <DraftStoryboardPreview
                      params={msg.params}
                      locale={locale}
                      onChange={(params) => updateStoryboard(msg.id, params)}
                      onProceed={handleCopyPreview}
                      isProceeding={previewLoading}
                    />
                  )}
                  {msg.role === 'ai' && msg.clarification && !msg.isTyping && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, ease: [0.19, 1, 0.22, 1] }}
                      className="w-full rounded-[20px] border border-white/70 bg-white/68 p-3 shadow-[0_14px_36px_rgba(87,119,185,0.12)] backdrop-blur-xl"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-black leading-6 text-[#111111]">{msg.clarification.question}</p>
                        <button
                          type="button"
                          onClick={() => (
                            msg.clarification?.variant === 'refinement'
                              ? dismissClarification(msg.id)
                              : handleClarificationSelect(null)
                          )}
                          disabled={isWaiting || isRevealingMessage}
                          className="shrink-0 rounded-full p-1 text-[#6b7280] transition-colors hover:bg-[#f3f4f6] disabled:opacity-40"
                          aria-label={locale === 'en' ? 'Close options' : '선택지 닫기'}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-3 space-y-2">
                        {msg.clarification.options.map((option, index) => (
                          <button
                            key={`${msg.id}-${option.label}-${index}`}
                            type="button"
                            onClick={() => handleClarificationSelect(option)}
                            disabled={isWaiting || isRevealingMessage}
                            className="group flex w-full items-center gap-3 rounded-xl border border-white/70 bg-white/45 hover:bg-white/70 px-3 py-2.5 text-left transition-all hover:shadow-[0_10px_24px_rgba(87,119,185,0.10)] disabled:opacity-50"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-black text-[#6b7280] shadow-sm group-hover:text-[#3b82f6]">
                              {index + 1}
                            </span>
                            <span title={option.label} className="min-w-0 flex-1 truncate text-sm font-bold leading-5 text-[#374151]">{option.label}</span>
                            <ArrowRight className="h-4 w-4 shrink-0 text-[#9ca3af] opacity-0 transition-opacity group-hover:opacity-100" />
                          </button>
                        ))}
                      </div>
                      {msg.clarification.allowCustom && (
                        <p className="mt-3 text-[11px] font-semibold text-[#9A8C80]">
                          {locale === 'en' ? 'Or type your own answer in the input below.' : '또는 아래 입력창에 직접 답변해도 됩니다.'}
                        </p>
                      )}
                      {msg.clarification.variant === 'refinement' && (
                        <div className="mt-3 flex flex-col gap-2 border-t border-[#e5e7eb] pt-3 sm:flex-row">
                          <button
                            type="button"
                            onClick={handleCopyPreview}
                            disabled={isWaiting || isRevealingMessage || previewLoading}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#111827] px-3 py-2.5 text-xs font-black text-white transition hover:bg-[#1f2937] disabled:opacity-40"
                          >
                            {previewLoading ? (
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            {locale === 'en' ? 'Use this draft' : '이 초안으로 진행'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleClarificationSelect({
                              label: locale === 'en' ? 'Try another topic' : '다른 주제로 만들기',
                              value: NEW_TOPIC_OPTION_VALUE,
                            })}
                            disabled={isWaiting || isRevealingMessage}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#e5e7eb] bg-white px-3 py-2.5 text-xs font-black text-[#374151] transition hover:border-[#3b82f6] hover:bg-[#f9fafb] disabled:opacity-40"
                          >
                            {locale === 'en' ? 'Try another topic' : '다른 주제로 만들기'}
                          </button>
                        </div>
                      )}
                      {msg.clarification.skipLabel && (
                        <button
                          type="button"
                          onClick={() => handleClarificationSelect(null)}
                          disabled={isWaiting || isRevealingMessage}
                          className="mt-3 rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-xs font-black text-[#374151] transition hover:border-[#3b82f6] disabled:opacity-40"
                        >
                          {msg.clarification.skipLabel}
                        </button>
                      )}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* AI thinking indicator */}
          {isWaiting && displayMessages.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={smoothTransition}
              className="flex justify-start"
            >
              <div className="flex flex-col gap-2.5 items-start">
                <span className="text-[11px] font-semibold text-[#6b7280] tracking-wide">Shuffla</span>
                <ThinkingBubble steps={thinkingSteps} />
              </div>
            </motion.div>
          )}

          {/* Confirm CTA */}
          {readyParams && !isWaiting && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.19, 1, 0.22, 1], delay: 0.15 }}
              className="flex justify-start pt-2"
            >
              <div className="flex flex-col gap-3.5 w-full max-w-md">
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-750">
                    {error}
                  </div>
                )}
                <div className="rounded-[20px] border border-white/70 bg-white/62 p-4.5 space-y-3.5 shadow-[0_18px_44px_rgba(87,119,185,0.13)] backdrop-blur-xl" onPaste={handlePaste}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-[#111111]">{t('attach_image')}</p>
                      <p className="text-[10px] text-[#6b7280] mt-0.5 font-semibold">{t('attach_image_desc')}</p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#e5e7eb] bg-white px-3.5 py-2.5 text-xs font-bold text-[#111111] transition-all hover:border-[#3b82f6] hover:bg-[#fafaf9] shadow-sm active:scale-98">
                      <ImagePlus className="h-3.5 w-3.5 text-[#3b82f6]" />
                      {t('select_file')}
                      <input type="file" accept="image/*" multiple className="hidden" onChange={selectReferenceFiles} />
                    </label>
                  </div>
                  {referenceFiles.length === 0 && (
                    <p className="text-[10px] text-[#9ca3af] text-center py-1">{t('paste_hint')}</p>
                  )}
                  {referenceFiles.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {referenceFiles.map((file) => (
                        <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-2 text-xs text-[#374151] bg-white border border-[#e5e7eb] rounded-xl px-3 py-1.5 shadow-sm">
                          <span className="truncate font-bold">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => setReferenceFiles(current => current.filter(item => item !== file))}
                            className="rounded-full p-1 text-[#6b7280] hover:bg-[#f3f4f6] transition-colors"
                            aria-label={`${file.name} 제거`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleCopyPreview}
                  disabled={previewLoading}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-[#111827] hover:bg-[#1f2937] py-4 text-sm font-black text-white transition-all hover:shadow-md active:scale-[0.99] disabled:opacity-60"
                >
                  {previewLoading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      {t('copy_preview_generating')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-white" />
                      {t('copy_preview_cta')}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input bar */}
        <div className="relative z-30 shrink-0 bg-transparent px-4 pt-3" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          <div className="mx-auto w-full max-w-[920px]">
            <form onSubmit={handleSend}>
              <div className="flex items-center gap-2 rounded-[22px] border border-white/75 bg-white px-3 py-2 shadow-[0_18px_42px_rgba(87,119,185,0.12)] transition-all focus-within:border-[#bdd0ff] focus-within:shadow-[0_22px_54px_rgba(87,119,185,0.16)]">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    pendingNewTopic
                      ? (locale === 'en' ? 'Enter the new topic to research from scratch' : '새로 만들 주제를 입력하세요')
                      : readyParams ? t('feedback_placeholder') : t('input_placeholder')
                  }
                  disabled={isWaiting || isRevealingMessage}
                  className="h-10 flex-1 bg-transparent border-none outline-none px-2 text-sm text-[#111111] placeholder-[#9ca3af] disabled:opacity-50 font-medium"
                  autoFocus
                />
                {isWaiting && (
                  <button
                    type="button"
                    onClick={handleCancelAgent}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-[#9ca3af] hover:text-[#6b7280] transition-colors"
                    title={locale === 'en' ? 'Cancel' : '취소'}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <label
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-[#9ca3af] transition-colors hover:bg-[#f8fafc] hover:text-[#3b82f6]"
                  title={locale === 'en' ? 'Add reference image' : '참고 이미지 추가'}
                >
                  <ImagePlus className="h-4 w-4" />
                  <input type="file" accept="image/*" multiple className="hidden" onChange={selectReferenceFiles} />
                </label>
                <div className="flex items-center gap-1 rounded-full border border-[#e5e7eb] bg-white/84 p-1">
                  {([3, 5, 7] as const).map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setSelectedSlideCount(count)}
                      aria-pressed={selectedSlideCount === count}
                      className={`h-6 rounded-full px-2 text-[11px] font-bold transition-all ${
                        selectedSlideCount === count
                          ? 'bg-[#4252ff] text-white'
                          : 'text-[#64748b] hover:bg-[#f5f7ff] hover:text-[#3730a3]'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={!input.trim() || isWaiting || isRevealingMessage}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111827] text-white transition hover:bg-[#1f2937] disabled:opacity-30 shrink-0"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

// ── Role label map ────────────────────────────────────────────────

function ImageCardNewsHeroMockup() {
  const cards = [
    {
      label: '01',
      title: '후킹을 잡고',
      body: '첫 장에서 시선을 멈추게 합니다',
      tone: 'from-[#dbeafe] via-[#f4f7ff] to-[#ffffff]',
      panel: 'bg-[#111827]',
    },
    {
      label: '02',
      title: '메시지를 엮고',
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
    <div className="pointer-events-none mt-10 flex w-full max-w-[720px] items-end justify-center gap-3 px-4">
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

function DraftStoryboardPreview({
  params,
  locale,
  onChange,
  onProceed,
  isProceeding,
}: {
  params: GenerateParams
  locale: string
  onChange: (params: GenerateParams) => void
  onProceed: () => void
  isProceeding: boolean
}) {
  const slides = params.draftSlides?.length
    ? params.draftSlides
    : (params.structurePreview ?? []).map(slide => ({
      slideNumber: slide.slideNumber,
      role: slide.role,
      headline: slide.description,
      body: locale === 'en' ? 'This card will develop the idea with clear supporting context.' : '이 카드에서 핵심 맥락과 근거를 시각적으로 풀어냅니다.',
      reasoning: 'Structure preview fallback',
    }))
  const templates = useMemo(() => getTemplateDirections(params), [params])
  const [templateId, setTemplateId] = useState(templates[0].id)
  const [selectedSlideNumber, setSelectedSlideNumber] = useState(slides[0]?.slideNumber ?? 1)
  const [isEditing, setIsEditing] = useState(false)
  const template = templates.find(item => item.id === templateId) ?? templates[0]
  const selectedSlide = slides.find(slide => slide.slideNumber === selectedSlideNumber) ?? slides[0]
  const isEn = locale === 'en'

  const selectTemplate = (nextTemplate: typeof template) => {
    setTemplateId(nextTemplate.id)
    onChange({
      ...params,
      visualHint: `${params.visualHint}\nSelected visual template: ${nextTemplate.name}`.trim(),
      reasonForStyle: isEn
        ? `${nextTemplate.name} was selected for a ${nextTemplate.mood.toLowerCase()} visual rhythm.`
        : `${nextTemplate.name} 템플릿으로 ${nextTemplate.mood} 무드를 적용합니다.`,
    })
  }

  const updateSlide = (field: 'headline' | 'body', value: string) => {
    if (!selectedSlide) return
    onChange({
      ...params,
      draftSlides: slides.map(slide => (
        slide.slideNumber === selectedSlide.slideNumber ? { ...slide, [field]: value } : slide
      )),
    })
  }

  const moveSlide = (direction: -1 | 1) => {
    if (!selectedSlide) return
    const currentIndex = slides.findIndex(slide => slide.slideNumber === selectedSlide.slideNumber)
    const nextIndex = currentIndex + direction
    if (nextIndex < 0 || nextIndex >= slides.length) return
    const reordered = [...slides]
    ;[reordered[currentIndex], reordered[nextIndex]] = [reordered[nextIndex], reordered[currentIndex]]
    onChange({
      ...params,
      draftSlides: reordered.map((slide, index) => ({ ...slide, slideNumber: index + 1 })),
    })
    setSelectedSlideNumber(nextIndex + 1)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.58, ease: [0.19, 1, 0.22, 1] }}
      className="w-full overflow-hidden rounded-[24px] border border-[#dfe5ec] bg-[#f8fafc] shadow-[0_24px_64px_rgba(15,23,42,0.14)]"
    >
      <div className="hidden">
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            isEn ? 'Brief' : '기획',
            isEn ? 'Storyboard' : '스토리보드',
            isEn ? 'Copy review' : '카피 검토',
            isEn ? 'Generate' : '최종 생성',
          ].map((step, index) => (
            <div key={step} className="flex shrink-0 items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black ${index < 2 ? 'bg-[#111827] text-white' : 'border border-[#dbe2ea] bg-white text-[#94a3b8]'}`}>
                {index < 1 ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              <span className={`text-[10px] font-black ${index === 1 ? 'text-[#111827]' : 'text-[#94a3b8]'}`}>{step}</span>
              {index < 3 && <ChevronRight className="h-3.5 w-3.5 text-[#cbd5e1]" />}
            </div>
          ))}
        </div>
      </div>

      <StoryboardStage3D
        slides={slides}
        swatches={template.swatches}
        selectedSlideNumber={selectedSlide?.slideNumber ?? 1}
        onSelect={(slideNumber: number) => {
          setSelectedSlideNumber(slideNumber)
          setIsEditing(false)
        }}
        locale={locale}
      />

      <div className="flex flex-col gap-3 bg-white px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[#111827] px-3 text-[11px] font-black text-white">
              <Sparkles className="h-3.5 w-3.5" />
              {isEn ? 'Storyboard ready' : '스토리보드 준비 완료'}
            </span>
            <span className="rounded-full border border-[#dbeafe] bg-[#eff6ff] px-2.5 py-1 text-[10px] font-black text-[#2563eb]">
              {slides.length}{isEn ? ' cards' : '장'}
            </span>
          </div>
          <h3 className="mt-3 text-base font-black leading-6 text-[#111827] sm:text-lg">
            {params.topic}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[#64748b]">
            {params.hookDirection || params.objective || params.contentType}
          </p>
        </div>

        <div className="grid min-w-[190px] grid-cols-3 gap-1.5 rounded-[16px] border border-[#e5e7eb] bg-[#f8fafc] p-1.5">
          {template.swatches.map((color, index) => (
            <span
              key={`${color}-${index}`}
              className="h-8 rounded-xl border border-white shadow-sm"
              style={{ background: color }}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-[#edf0f3] bg-white px-4 py-4 sm:px-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-[#475569]" />
            <p className="text-xs font-black text-[#111827]">{isEn ? 'Choose a visual direction' : '비주얼 템플릿 선택'}</p>
          </div>
          <p className="text-[10px] font-semibold text-[#94a3b8]">{isEn ? 'Previewed with your copy' : '현재 카피로 바로 비교'}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {templates.map(item => (
            <TemplateDirectionCard
              key={item.id}
              template={item}
              selected={item.id === template.id}
              onSelect={() => selectTemplate(item)}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-[#e2e8f0] px-4 py-4 sm:px-5">
        <div className="hidden">
          <div>
            <p className="text-xs font-black text-[#111827]">{isEn ? 'Shape the story' : '카드 흐름 다듬기'}</p>
            <p className="mt-0.5 text-[10px] font-semibold text-[#94a3b8]">{isEn ? 'Select a card to review and edit it.' : '카드를 선택하면 카피와 순서를 수정할 수 있어요.'}</p>
          </div>
          <span className="shrink-0 text-[10px] font-black text-[#64748b]">{slides.length} CARDS</span>
        </div>
        <div className="hidden">
          <div className="flex min-w-0 gap-3">
          {slides.map((slide, index) => (
            <DraftCardMockup
              key={`${slide.slideNumber}-${slide.headline}`}
              slide={slide}
              index={index}
              total={slides.length}
              template={template}
              selected={slide.slideNumber === selectedSlide?.slideNumber}
              onSelect={() => {
                setSelectedSlideNumber(slide.slideNumber)
                setIsEditing(false)
              }}
            />
          ))}
          </div>
        </div>

        {selectedSlide && (
          <motion.div layout className="rounded-[18px] border border-[#dbe2ea] bg-white p-3.5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#111827] text-[10px] font-black text-white">{String(selectedSlide.slideNumber).padStart(2, '0')}</span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-[#111827]">{selectedSlide.headline}</p>
                  <p className="mt-0.5 text-[9px] font-black uppercase text-[#94a3b8]">{ROLE_LABEL[selectedSlide.role] ?? selectedSlide.role}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => moveSlide(-1)} disabled={selectedSlide.slideNumber === 1} title={isEn ? 'Move left' : '앞으로 이동'} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f8fafc] disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => moveSlide(1)} disabled={selectedSlide.slideNumber === slides.length} title={isEn ? 'Move right' : '뒤로 이동'} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f8fafc] disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => setIsEditing(value => !value)} className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-black ${isEditing ? 'bg-[#111827] text-white' : 'border border-[#e2e8f0] bg-white text-[#475569] hover:bg-[#f8fafc]'}`}><Pencil className="h-3 w-3" />{isEn ? 'Edit' : '수정'}</button>
              </div>
            </div>
            <AnimatePresence initial={false}>
              {isEditing && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="grid gap-3 pt-3 sm:grid-cols-2">
                    <label className="text-[10px] font-black text-[#64748b]">{isEn ? 'Headline' : '헤드라인'}<textarea value={selectedSlide.headline} onChange={event => updateSlide('headline', event.target.value)} className="mt-1.5 min-h-20 w-full resize-none rounded-xl border border-[#dbe2ea] bg-[#f8fafc] p-2.5 text-xs font-bold leading-5 text-[#111827] outline-none focus:border-[#6366f1]" /></label>
                    <label className="text-[10px] font-black text-[#64748b]">{isEn ? 'Body copy' : '본문 카피'}<textarea value={selectedSlide.body} onChange={event => updateSlide('body', event.target.value)} className="mt-1.5 min-h-20 w-full resize-none rounded-xl border border-[#dbe2ea] bg-[#f8fafc] p-2.5 text-xs font-semibold leading-5 text-[#334155] outline-none focus:border-[#6366f1]" /></label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        <div className="mt-4 flex flex-col gap-3 border-t border-[#e2e8f0] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-md text-[10px] font-semibold leading-5 text-[#64748b]">{params.reasonForStyle || (isEn ? 'The visual system will stay consistent across every card.' : '선택한 템플릿의 타이포와 컬러 시스템이 모든 카드에 일관되게 적용됩니다.')}</p>
          <button type="button" onClick={onProceed} disabled={isProceeding} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#111827] px-5 text-xs font-black text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)] transition hover:bg-[#293244] disabled:opacity-50">
            {isProceeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isEn ? 'Approve and review copy' : '이 구성으로 카피 검토'}
            {!isProceeding && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function TemplateDirectionCard({ template, selected, onSelect }: { template: TemplateDirection; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} className={`group min-w-0 rounded-[14px] border p-2 text-left transition ${selected ? 'border-[#111827] bg-[#f8fafc] shadow-[0_8px_20px_rgba(15,23,42,0.08)]' : 'border-[#e2e8f0] bg-white hover:border-[#aab4c2]'}`}>
      <div className="relative h-12 overflow-hidden rounded-[9px]" style={{ background: template.background }}>
        <div className="absolute inset-x-2 bottom-2 flex gap-1">{template.swatches.map(color => <span key={color} className="h-1.5 flex-1 rounded-full" style={{ background: color }} />)}</div>
        {selected && <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#111827] shadow-sm"><Check className="h-3 w-3" /></span>}
      </div>
      <p className="mt-2 truncate text-[11px] font-black text-[#111827]">{template.name}</p>
      <p className="mt-0.5 truncate text-[9px] font-semibold text-[#94a3b8]">{template.mood}</p>
    </button>
  )
}

const ROLE_LABEL: Record<string, string> = {
  hook: 'HOOK',
  context: 'CONTEXT',
  'key-point': 'KEY POINT',
  benefit: 'BENEFIT',
  proof: 'PROOF',
  detail: 'DETAIL',
  stat: 'STAT',
  summary: 'SUMMARY',
  cta: 'CTA',
  'save-cta': 'CTA',
}

function DraftCardMockup({
  slide,
  index,
  total,
  template,
  selected,
  onSelect,
}: {
  slide: NonNullable<GenerateParams['draftSlides']>[number]
  index: number
  total: number
  template: TemplateDirection
  selected: boolean
  onSelect: () => void
}) {
  const basis = total <= 3 ? '31%' : total <= 5 ? '23%' : '18%'
  const roleLabel = ROLE_LABEL[slide.role] ?? slide.role
  const accent = template.swatches[index % template.swatches.length]

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      layout
      initial={{ opacity: 0, x: 26, y: 10, rotate: index % 2 === 0 ? -1.5 : 1.5 }}
      animate={{ opacity: 1, x: 0, y: 0, rotate: index % 2 === 0 ? -1.5 : 1.5 }}
      transition={{ duration: 0.48, delay: index * 0.055, ease: [0.19, 1, 0.22, 1] }}
      style={{ flex: `0 0 ${basis}`, minWidth: total <= 3 ? 150 : 132 }}
      className={`relative overflow-hidden rounded-[18px] border bg-white p-1.5 text-left transition ${selected ? 'border-[#111827] shadow-[0_18px_42px_rgba(15,23,42,0.16)] ring-2 ring-[#111827]/10' : 'border-[#dbe2ea] shadow-[0_12px_28px_rgba(15,23,42,0.08)] hover:-translate-y-1'}`}
    >
      <span className={`absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full shadow-sm ${selected ? 'bg-[#111827] text-white' : 'bg-white/90 text-[#94a3b8]'}`}><GripVertical className="h-3.5 w-3.5" /></span>
      <div className="aspect-[4/5] overflow-hidden rounded-[15px] bg-[#111827]">
        <div className="relative h-[45%] overflow-hidden" style={{ background: template.background }}>
          <div className="absolute inset-0 opacity-70" style={{ background: `radial-gradient(circle at 24% 22%, ${accent}, transparent 34%)` }} />
          <div className="absolute left-3 top-3 rounded-full bg-white/88 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.13em] text-[#111827]">
            {roleLabel}
          </div>
          <div className="absolute bottom-3 left-3 right-3">
            <div className="h-2 w-2/3 rounded-full bg-white/80" />
            <div className="mt-1.5 h-2 w-1/2 rounded-full bg-white/45" />
          </div>
        </div>
        <div className="flex h-[55%] flex-col justify-between bg-white p-3">
          <div>
            <p className="text-[9px] font-black text-[#64748b]">CARD {String(slide.slideNumber).padStart(2, '0')}</p>
            <h4 className="mt-1.5 line-clamp-2 text-[13px] font-black leading-[1.25] text-[#111827]">
              {slide.headline}
            </h4>
          </div>
          <p className="mt-2 line-clamp-4 text-[10px] font-semibold leading-4 text-[#475569]">
            {slide.body}
          </p>
        </div>
      </div>
    </motion.button>
  )
}

interface TemplateDirection {
  id: string
  name: string
  mood: string
  cta: string
  background: string
  swatches: string[]
}

function getTemplateDirections(params: GenerateParams): TemplateDirection[] {
  const text = `${params.contentType} ${params.objective} ${params.visualHint} ${params.targetEmotion ?? ''}`.toLowerCase()
  const editorial: TemplateDirection = {
    id: 'editorial',
    name: 'Editorial brief',
    mood: 'Sharp and current',
    cta: 'Save and share',
    background: 'linear-gradient(135deg, #0f172a 0%, #334155 54%, #f8fafc 100%)',
    swatches: ['#0f172a', '#f59e0b', '#f8fafc'],
  }
  const premium: TemplateDirection = {
    id: 'premium',
    name: 'Premium product',
    mood: 'Calm and polished',
    cta: 'Explore product',
    background: 'linear-gradient(135deg, #f8fafc 0%, #dbeafe 52%, #111827 100%)',
    swatches: ['#111827', '#dbeafe', '#10b981'],
  }
  const friendly: TemplateDirection = {
    id: 'friendly',
    name: 'Friendly guide',
    mood: 'Clear and warm',
    cta: 'Try it today',
    background: 'linear-gradient(135deg, #ecfeff 0%, #eef2ff 48%, #fef3c7 100%)',
    swatches: ['#2563eb', '#14b8a6', '#f59e0b'],
  }

  if (text.includes('news') || text.includes('trend') || text.includes('issue') || text.includes('뉴스') || text.includes('트렌드')) {
    return [editorial, friendly, premium]
  }
  if (text.includes('premium') || text.includes('brand') || text.includes('product') || text.includes('브랜드') || text.includes('제품')) {
    return [premium, editorial, friendly]
  }
  return [friendly, editorial, premium]
}

function _pickTemplateDirection(params: GenerateParams) {
  const text = `${params.contentType} ${params.objective} ${params.visualHint} ${params.targetEmotion ?? ''}`.toLowerCase()

  if (text.includes('news') || text.includes('trend') || text.includes('issue') || text.includes('뉴스') || text.includes('트렌드')) {
    return {
      name: 'Editorial brief',
      mood: 'Sharp and current',
      cta: 'Save and share',
      background: 'linear-gradient(135deg, #0f172a 0%, #334155 54%, #f8fafc 100%)',
      swatches: ['#0f172a', '#f59e0b', '#f8fafc'],
    }
  }

  if (text.includes('premium') || text.includes('brand') || text.includes('product') || text.includes('브랜드') || text.includes('제품')) {
    return {
      name: 'Premium product',
      mood: 'Calm and polished',
      cta: 'Explore product',
      background: 'linear-gradient(135deg, #f8fafc 0%, #dbeafe 52%, #111827 100%)',
      swatches: ['#111827', '#dbeafe', '#10b981'],
    }
  }

  return {
    name: 'Friendly guide',
    mood: 'Clear and warm',
    cta: 'Try it today',
    background: 'linear-gradient(135deg, #ecfeff 0%, #eef2ff 48%, #fef3c7 100%)',
    swatches: ['#2563eb', '#14b8a6', '#f59e0b'],
  }
}

function CopyPreviewPanel({
  slides,
  referenceFiles,
  setReferenceFiles,
  error,
  onBack,
  onConfirm,
  t,
  locale,
}: {
  slides: CopyPreviewSlide[]
  referenceFiles: File[]
  setReferenceFiles: React.Dispatch<React.SetStateAction<File[]>>
  error: string | null
  onBack: () => void
  onConfirm: (slides: CopyPreviewSlide[]) => void
  t: (key: string) => string
  locale: string
}) {
  const [editedSlides, setEditedSlides] = useState<CopyPreviewSlide[]>(
    slides.map(s => ({ ...s }))
  )

  const updateSlide = (slideNumber: number, field: 'headline' | 'body', value: string) => {
    setEditedSlides(prev => prev.map(s => s.slideNumber === slideNumber ? { ...s, [field]: value } : s))
  }

  const totalCharacters = editedSlides.reduce((sum, slide) => sum + slide.headline.length + slide.body.length, 0)

  return (
    <div className="flex h-full flex-col bg-white text-[#111111]">
      {/* Header */}
      <div className="shrink-0 border-b border-[#e5e7eb] bg-white px-5 py-4">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#374151] shadow-sm">
              <Sparkle className="h-3 w-3" />
              Copy Desk
            </div>
            <h2 className="mt-2 text-lg font-black tracking-[-0.02em] text-[#111111]">{t('copy_preview_title')}</h2>
            <p className="mt-1 truncate text-xs font-semibold text-[#6b7280]">{t('copy_preview_desc')}</p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-xs font-black text-[#374151] shadow-sm transition-all hover:border-[#9ca3af] hover:bg-[#f9fafb]"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {t('copy_preview_back')}
          </button>
        </div>
      </div>

      {/* Slide list */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {error && (
          <div className="mx-auto mb-4 max-w-4xl rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {error}
          </div>
        )}

        <div className="mx-auto flex max-w-4xl flex-col gap-3">
          {editedSlides.map((slide, idx) => (
            <motion.div
              key={slide.slideNumber}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1], delay: idx * 0.04 }}
              className="group rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm transition-all focus-within:border-[#3b82f6] focus-within:bg-white hover:border-[#d1d5db] hover:bg-white"
            >
              <div className="grid gap-4 sm:grid-cols-[92px_minmax(0,1fr)]">
                <div className="flex items-center gap-2 sm:block">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111827] text-xs font-black text-white shadow-sm">
                    {String(slide.slideNumber).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 sm:mt-3">
                    <span className="inline-flex max-w-full rounded-full border border-[#e5e7eb] bg-[#f3f4f6] px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#374151]">
                      <span className="truncate">{slide.role}</span>
                    </span>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#9ca3af]">
                      {locale === 'en' ? 'Headline' : '제목'}
                    </span>
                    <span className="text-[10px] font-bold text-[#9ca3af]">{slide.headline.length}</span>
                  </div>
                  <input
                    type="text"
                    value={slide.headline}
                    onChange={(e) => updateSlide(slide.slideNumber, 'headline', e.target.value)}
                    placeholder={locale === 'en' ? 'Headline' : '제목'}
                    className="h-11 w-full rounded-xl border border-[#e5e7eb] bg-white px-3 text-base font-black tracking-[-0.01em] text-[#111111] outline-none transition-all placeholder:text-[#9ca3af] focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/10"
                  />
                  <div className="mt-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#9ca3af]">
                        {locale === 'en' ? 'Body copy' : '본문'}
                      </span>
                      <span className="text-[10px] font-bold text-[#9ca3af]">{slide.body.length}</span>
                    </div>
                    <textarea
                      value={slide.body}
                      onChange={(e) => updateSlide(slide.slideNumber, 'body', e.target.value)}
                      placeholder={locale === 'en' ? 'Body copy' : '본문'}
                      rows={3}
                      className="min-h-[96px] w-full resize-y rounded-xl border border-[#e5e7eb] bg-white px-3 py-2.5 text-sm font-semibold leading-6 text-[#374151] outline-none transition-all placeholder:text-[#9ca3af] focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/10"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Image attach */}
        <div className="mx-auto mt-4 max-w-4xl rounded-xl border border-[#e5e7eb] bg-[#fafaf9] p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-[#111111]">{t('attach_image')}</p>
              <p className="mt-0.5 text-[10px] font-semibold text-[#6b7280]">{t('attach_image_desc')}</p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#e5e7eb] bg-white px-3.5 py-2.5 text-xs font-black text-[#111111] shadow-sm transition-all hover:border-[#3b82f6] hover:bg-[#f9fafb]">
              <ImagePlus className="h-3.5 w-3.5 text-[#3b82f6]" />
              {t('select_file')}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('image/'))
                  e.target.value = ''
                  setReferenceFiles(prev => {
                    const merged = [...prev, ...files]
                    return merged.length > 4 ? prev : merged
                  })
                }}
              />
            </label>
          </div>
          {referenceFiles.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {referenceFiles.map((file) => (
                <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-2 rounded-xl border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs text-[#374151]">
                  <span className="truncate font-medium">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setReferenceFiles(prev => prev.filter(f => f !== file))}
                    className="rounded-full p-1 text-[#6b7280] transition-colors hover:bg-[#f3f4f6]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-24" />
      </div>

      {/* Sticky bottom bar */}
      <div className="shrink-0 border-t border-[#e5e7eb] bg-white px-5 py-3.5">
        <div className="mx-auto flex max-w-4xl items-center gap-4">
          <div className="hidden min-w-0 flex-1 sm:block">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9ca3af]">
              {editedSlides.length} slides · {totalCharacters} chars
            </p>
            <p className="mt-0.5 truncate text-xs font-semibold text-[#374151]">{t('copy_preview_desc')}</p>
          </div>
          <button
            type="button"
            onClick={() => onConfirm(editedSlides)}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#111827] px-5 py-3 text-sm font-black text-white shadow-md transition-all hover:bg-[#1f2937] active:scale-[0.99] sm:w-auto sm:min-w-[220px]"
          >
            <Sparkles className="h-4 w-4" />
            {t('copy_preview_confirm')}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

interface PromoPaymentModalProps {
  processing: boolean
  error: string | null
  onSelect: (plan: 'PRO' | 'UNLIMITED') => void
  onClose: () => void
}

function PromoPaymentModal({
  processing,
  error,
  onSelect,
  onClose,
}: PromoPaymentModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [selectedPlan, setSelectedPlan] = useState<'PRO' | 'UNLIMITED'>('PRO')

  const planPrice = selectedPlan === 'PRO' ? '25,000원' : '39,000원'

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === overlayRef.current && !processing) onClose() }}
    >
      {/* 9:16 카드 컨테이너 */}
      <div
        className="relative overflow-hidden rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.6)]"
        style={{ width: 'min(380px, 90vw)', height: 'min(675px, 90vh)', aspectRatio: '9/16' }}
      >
        {/* ── 전체 배경: 이미지 */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/promo-card-bg.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center 20%',
          }}
        />

        {/* ── 하단부 블러 마스크: 이미지가 점점 흐려지며 사라지는 효과 */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, transparent 0%, transparent 20%, rgba(30,28,26,0.55) 42%, rgba(38,35,32,0.88) 58%, rgba(44,41,38,0.97) 70%, #2a2724 80%)',
          }}
        />

        {/* ── 닫기 버튼 */}
        <div className="absolute top-4 right-4 z-20">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm text-white/60 transition hover:bg-black/50 hover:text-white disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── 텍스트 영역: 이미지 위 하단 fade 구간 */}
        <div className="absolute z-10 px-7" style={{ top: '28%' }}>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">Shuffla · 특별 혜택</p>
          <h2
            className="font-black text-white leading-[1.18] tracking-[-0.03em] mb-2"
            style={{ fontSize: 'clamp(20px, 5vw, 24px)' }}
          >
            무료 체험 기간이<br />끝났어도<br />괜찮습니다
          </h2>
          <p className="text-xs text-white/55 font-medium leading-relaxed">
            플랜을 선택하면 계속<br />카드뉴스를 만들 수 있어요
          </p>
        </div>

        {/* ── 하단 결제 영역 */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-5" style={{ top: '56%', background: 'linear-gradient(to bottom, transparent 0%, rgba(44,41,38,0.97) 12%, #2a2724 22%)' }}>
          {/* 플랜 탭 */}
          <div className="flex gap-2 mb-3">
            {(['PRO', 'UNLIMITED'] as const).map((plan) => (
              <button
                key={plan}
                type="button"
                onClick={() => setSelectedPlan(plan)}
                disabled={processing}
                className={`flex-1 py-2 rounded-xl text-[11px] font-black tracking-wide transition-all ${
                  selectedPlan === plan
                    ? 'bg-white text-[#1a1410]'
                    : 'bg-white/10 text-white/40 hover:bg-white/15 hover:text-white/60'
                }`}
              >
                <span>{plan === 'PRO' ? 'Creator' : 'Studio'}</span>
                <span className={`ml-1 text-[10px] font-bold ${selectedPlan === plan ? 'text-[#3b82f6]' : 'text-white/25'}`}>
                  {plan === 'PRO' ? '25,000원' : '39,000원'}
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {error && (
              <p className="rounded-xl bg-red-500/15 px-4 py-2 text-[11px] font-bold text-red-400 border border-red-500/20">
                {error}
              </p>
            )}

            {/* 결제 버튼 */}
            <button
              type="button"
              onClick={() => onSelect(selectedPlan)}
              disabled={processing}
              className="w-full rounded-2xl bg-white py-3 text-sm font-black text-[#1a1410] shadow-[0_8px_24px_rgba(255,255,255,0.12)] transition-all hover:bg-white/90 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 mt-1"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  결제창 여는 중...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  <span>{planPrice} · {selectedPlan === 'PRO' ? 'Creator' : 'Studio'} 구독하기</span>
                </>
              )}
            </button>

            <p className="text-[9px] text-white/20 text-center pt-0.5">
              월 정기결제 · 언제든 해지 가능 · 안전한 결제(Polar)
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}


function ThinkingBubble({ steps }: { steps: Array<{ step: string; text: string }> }) {
  const [expanded, setExpanded] = useState(false)
  const lastStep = steps[steps.length - 1]
  const currentLabel = lastStep?.text || '생각하는 중...'

  // Auto-expand when real steps arrive
  useEffect(() => {
    if (steps.length === 0) return
    const timer = window.setTimeout(() => setExpanded(true), 0)
    return () => window.clearTimeout(timer)
  }, [steps.length])

  return (
    <button
      type="button"
      onClick={() => setExpanded(v => !v)}
      className="group max-w-xs rounded-[20px] rounded-tl-md border border-[#edf1f5] bg-white text-left shadow-[0_14px_36px_rgba(15,23,42,0.06)] transition-all hover:border-[#d8dee6] hover:shadow-[0_18px_46px_rgba(15,23,42,0.08)]"
    >
      <div className="flex items-center gap-2.5 px-4 py-3">
        <div className="flex gap-1 shrink-0">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9ca3af]" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9ca3af]" style={{ animationDelay: '120ms' }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9ca3af]" style={{ animationDelay: '240ms' }} />
        </div>
        <span className="text-[11px] font-semibold text-[#6b7280] line-clamp-1">{currentLabel}</span>
        <span className="ml-auto shrink-0 text-[10px] text-[#9ca3af] group-hover:text-[#6b7280] transition-colors">
          {expanded ? '▲' : '▼'}
        </span>
      </div>
      {expanded && steps.length > 0 && (
        <div className="border-t border-[#e5e7eb] px-4 pb-3 pt-2.5 max-h-48 overflow-y-auto">
          <div className="space-y-2">
            {steps.map((s, i) => (
              <div key={i} className={`text-[11px] leading-5 ${i === steps.length - 1 ? 'text-[#374151]' : 'text-[#9ca3af]'}`}>
                <div className="flex items-start gap-1.5">
                  <span className="shrink-0 mt-0.5">{i === steps.length - 1 ? '→' : '✓'}</span>
                  <span className="whitespace-pre-wrap">{i === steps.length - 1 ? <strong>{s.text}</strong> : s.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </button>
  )
}
