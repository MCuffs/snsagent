'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ImagePlus,
  Sparkles,
  Send,
  X,
  Target,
  Compass,
  Layers,
  Sparkle,
  ChevronLeft,
  Check,
  Loader2,
  CreditCard,
} from 'lucide-react'
import { analytics, timeEvent } from '../../../lib/analytics/thinkingdata'

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

function aiDisplay(content: string, clarification?: ClarificationPrompt): DisplayMessage {
  return { id: mkId(), role: 'ai', content, revealedContent: '', isTyping: true, clarification }
}

function userDisplay(content: string): DisplayMessage {
  return { id: mkId(), role: 'user', content, revealedContent: content, isTyping: false }
}

function getUserDisplayTextFromHistory(content: string, locale: string) {
  const newTopicPrefix = locale === 'en' ? 'New topic: ' : '새 주제로 전환: '
  return content.startsWith(newTopicPrefix) ? content.slice(newTopicPrefix.length) : content
}

function compactSlidePreview(slides: NonNullable<GenerateParams['structurePreview']>) {
  if (slides.length <= 4) return slides
  return [...slides.slice(0, 3), slides[slides.length - 1]]
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

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.15
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.25, 0.8, 0.25, 1] as const
    }
  }
}

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
  const [isWaiting, setIsWaiting] = useState(true)
  const [isRevealingMessage, setIsRevealingMessage] = useState(false)
  const [readyParams, setReadyParams] = useState<GenerateParams | null>(null)
  const [briefingStage, setBriefingStage] = useState(0)
  const [phase, setPhase] = useState<'chat' | 'preview' | 'generating'>('chat')
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [referenceFiles, setReferenceFiles] = useState<File[]>([])
  const [copyPreviewSlides, setCopyPreviewSlides] = useState<CopyPreviewSlide[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [pendingNewTopic, setPendingNewTopic] = useState(false)

  // Promo payment modal states
  const [showPromoModal, setShowPromoModal] = useState(false)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [thinkingSteps, setThinkingSteps] = useState<Array<{ step: string; text: string }>>([])

  const generating = phase === 'generating'

  const generationMode = brand.websiteUrl === 'general_profile' ? 'general' : 'brand'

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const typingTimerRef = useRef<number | null>(null)
  const briefingTimersRef = useRef<number[]>([])
  const generationStartedAtRef = useRef<number | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
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
    const message = aiDisplay(content, clarification)
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
        body: JSON.stringify({ messages: history, brandId: brand.id, language, generationMode }),
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
  }, [appendAiMessage, brand.id, generationMode, locale, language])

  // Load the initial Agent greeting (Brand Mode only)
  useEffect(() => {
    if (generationMode !== 'brand') return
    let active = true
    const loadGreeting = async () => {
      try {
        const res = await fetch('/api/agents/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [], brandId: brand.id, language, generationMode }),
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
  }, [generationMode, appendAiMessage, brand.id, language, locale])

  // Automated General Mode Briefing: greet and let the user enter a topic.
  // RSS is fetched server-side when the agent processes the user's message.
  // General Mode: show greeting and wait for user to enter a topic.
  // The agent route handles RSS fetching server-side when processing messages.
  useEffect(() => {
    if (generationMode !== 'general') return

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
        : text,
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
                      className={`absolute left-7 top-14 w-[2px] h-[34px] -translate-x-1/2 z-0 transition-colors duration-500 ${
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
      ` }} />

      {/* Chat panel */}
      <motion.div
        variants={formItemVariants}
        className="flex min-w-0 flex-1 flex-col border-r border-[#edf1f5] bg-white"
      >
        {/* Header containing Brand chip & Mode Label */}
        <div className="shrink-0 border-b border-[#edf1f5] bg-white/95 px-5 py-3 backdrop-blur flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#111111]">
            <span className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ backgroundColor: brand.mainColor || '#3b82f6' }} />
            {brand.name}
          </div>

          <div className="text-xs text-[#9ca3af]">
            {generationMode === 'general' ? t('mode_general') : t('mode_brand')}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-white px-6 py-8 space-y-7 custom-scrollbar" aria-live="polite">
          {/* Initial loading skeleton */}
          {displayMessages.length === 0 && isWaiting && (
            <div className="flex justify-start">
              <div className="flex flex-col gap-2.5 items-start">
                <span className="text-[11px] font-semibold text-[#6b7280] tracking-wide">Shuffla</span>
                <div className="rounded-xl rounded-tl-sm bg-white px-4 py-2.5">
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
                    className={`rounded-[20px] border px-4 py-3 text-sm leading-6 font-medium whitespace-pre-line shadow-[0_12px_32px_rgba(15,23,42,0.06)] ${
                      msg.role === 'user'
                        ? 'rounded-tr-md border-[#111827] bg-[#111827] text-white shadow-[0_14px_34px_rgba(15,23,42,0.16)]'
                        : 'rounded-tl-md border-[#edf1f5] bg-white text-[#111111]'
                    }`}
                  >
                    {msg.role === 'ai' ? msg.revealedContent : msg.content}
                    {msg.role === 'ai' && msg.isTyping && (
                      <span className="ml-0.5 inline-block h-[1em] w-px align-middle bg-[#9ca3af] animate-pulse" />
                    )}
                  </div>
                  {msg.role === 'ai' && msg.clarification && !msg.isTyping && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, ease: [0.19, 1, 0.22, 1] }}
                      className="w-full rounded-[20px] border border-[#edf1f5] bg-white p-3 shadow-[0_14px_36px_rgba(15,23,42,0.06)]"
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
                            className="group flex w-full items-center gap-3 rounded-xl border border-[#edf1f5] bg-[#fbfcfd] hover:bg-white px-3 py-2.5 text-left transition-all hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)] disabled:opacity-50"
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
                <div className="rounded-[20px] border border-[#edf1f5] bg-white p-4.5 space-y-3.5 shadow-[0_18px_44px_rgba(15,23,42,0.07)]" onPaste={handlePaste}>
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

        {/* Input bar */}
        <div className="shrink-0 border-t border-[#edf1f5] bg-white px-4 pb-5 pt-3">
          <form onSubmit={handleSend}>
            <div className="flex items-center gap-2 rounded-[22px] border border-[#e5eaf0] bg-white px-3 py-2 shadow-[0_18px_42px_rgba(15,23,42,0.08)] transition-all focus-within:border-[#cbd5e1] focus-within:shadow-[0_22px_54px_rgba(15,23,42,0.11)]">
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
      </motion.div>

      {/* AI Strategy Director Panel (hidden on mobile) */}
      <motion.div
        variants={formItemVariants}
        className="hidden w-[390px] shrink-0 flex-col bg-white text-[#111111] border-l border-[#e5e7eb] overflow-y-auto xl:flex custom-scrollbar"
      >
        <div className="border-b border-[#e5e7eb] px-5 py-5 bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#6b7280] flex items-center gap-1">
                <Sparkle className="h-3 w-3 fill-current" /> AI Content Director
              </p>
              <h3 className="mt-1 text-base font-black tracking-tight text-[#111111]">{t('director_title')}</h3>
            </div>
            {readyParams ? (
              <span className="flex items-center gap-1.5 rounded-full bg-[#EDF7F2] px-2.5 py-1 text-[10px] font-bold text-[#2F7E53] border border-[#C6EBCE]/50 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2F7E53] animate-pulse" />
                {t('status_ready')}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-[#FEF6EE] px-2.5 py-1 text-[10px] font-bold text-[#C27330] border border-[#FAD8BC]/50 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C27330] animate-pulse" />
                {t('status_waiting')}
              </span>
            )}
          </div>
        </div>

        {readyParams ? (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="flex-1 px-5 py-6 space-y-6"
          >
            {/* 1. Core Summary Card */}
            <motion.div 
              variants={itemVariants}
              className="rounded-xl border border-[#e5e7eb] bg-white p-4.5 space-y-3.5 shadow-sm"
            >
              <div className="flex justify-between border-b border-[#e5e7eb] pb-2.5">
                <span className="text-[11px] text-[#6b7280] font-bold">{t('topic_label')}</span>
                <span className="text-xs font-black text-[#111111] truncate max-w-[200px]">{readyParams.topic}</span>
              </div>
              <div className="flex justify-between border-b border-[#e5e7eb] pb-2.5">
                <span className="text-[11px] text-[#6b7280] font-bold">{t('visual_label')}</span>
                <span className="rounded bg-[#3b82f6]/10 border border-[#3b82f6]/20 px-2 py-0.5 text-[10px] font-black text-[#3b82f6]">
                  {readyParams.visualHint}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#e5e7eb] pb-2.5">
                <span className="text-[11px] text-[#6b7280] font-bold">{t('content_type_label')}</span>
                <span className="text-xs font-bold text-[#374151]">{readyParams.contentType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[11px] text-[#6b7280] font-bold">{t('slide_count_label')}</span>
                <span className="text-xs font-bold text-[#374151]">{t('slide_count_value', { count: readyParams.slideCount })}</span>
              </div>
              <div className="rounded-xl bg-[#f9fafb] px-3 py-3">
                <span className="block text-[10px] font-bold text-[#9ca3af] mb-1">{t('objective_label')}</span>
                <p className="text-xs font-semibold leading-5 text-[#374151]">{readyParams.objective}</p>
              </div>
            </motion.div>

            <AnimatePresence>
              {briefingStage >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, ease: [0.19, 1, 0.22, 1] }}
                  className="space-y-4"
                >
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#9ca3af] flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5 text-[#6b7280]" /> {t('hook_section')}
                  </h4>
                  <div className="bg-white border border-[#e5e7eb] rounded-xl p-4 space-y-3 shadow-sm">
                    {readyParams.hookDirection && (
                      <div>
                        <span className="block text-[9px] font-bold text-[#9ca3af]">{t('hook_label')}</span>
                        <p className="text-xs font-bold text-[#111111] mt-1 leading-5">{readyParams.hookDirection}</p>
                      </div>
                    )}
                    {readyParams.recommendedCta && (
                      <div className="border-t border-[#e5e7eb] pt-3">
                        <span className="block text-[9px] font-bold text-[#9ca3af]">{t('cta_label')}</span>
                        <p className="text-xs font-bold text-[#3b82f6] mt-1">{readyParams.recommendedCta}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 3. Slide Flow / Draft Copy Preview */}
            {briefingStage >= 3 && (
              ((readyParams.draftSlides && readyParams.draftSlides.length > 0) || (readyParams.structurePreview && readyParams.structurePreview.length > 0))
            ) && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: [0.19, 1, 0.22, 1] }}
                className="space-y-4 pt-2"
              >
                <h4 className="text-xs font-black uppercase tracking-wider text-[#9ca3af] flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-[#6b7280]" />
                  {readyParams.draftSlides && readyParams.draftSlides.length > 0 ? (locale === 'en' ? 'Draft Copy & Strategy' : '기획 및 카피 초안') : t('flow_section')}
                </h4>
                
                {readyParams.draftSlides && readyParams.draftSlides.length > 0 ? (
                  <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1.5 custom-scrollbar">
                    {readyParams.draftSlides.map((slide, idx) => (
                      <motion.div
                        key={`draft-${slide.slideNumber}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1], delay: idx * 0.05 }}
                        className="relative bg-white border border-[#e5e7eb] rounded-xl p-4.5 shadow-sm space-y-2.5 hover:border-[#d1d5db] transition-all"
                      >
                        <div className="flex items-center justify-between border-b border-[#e5e7eb] pb-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#111827] text-[10px] font-black text-white shadow-sm">
                            {slide.slideNumber}
                          </span>
                          <span className="rounded-full border border-[#e5e7eb] bg-[#f3f4f6] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#374151]">
                            {slide.role}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs font-black leading-5 text-[#111111]">{slide.headline}</p>
                          <p className="text-[11px] font-medium leading-relaxed text-[#374151]">{slide.body}</p>
                        </div>
                        {slide.reasoning && (
                          <div className="border-t border-[#e5e7eb] pt-2 mt-1">
                            <span className="block text-[8px] font-black text-[#6b7280] uppercase tracking-[0.12em]">{locale === 'en' ? 'Reasoning' : '디렉터 기획 의도'}</span>
                            <p className="text-[10px] text-[#6b7280] leading-relaxed mt-0.5 font-semibold">{slide.reasoning}</p>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="relative border-l border-dashed border-[#e5e7eb] pl-5 ml-2.5 space-y-5">
                      {compactSlidePreview(readyParams.structurePreview!).map((slide, idx) => (
                        <motion.div 
                          key={slide.slideNumber}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1], delay: idx * 0.08 + 0.3 }}
                          className="relative"
                        >
                          <span className="absolute -left-[30px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white border-2 border-[#3b82f6] text-[10px] font-black text-[#3b82f6] shadow-sm">
                            {slide.slideNumber}
                          </span>
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-black tracking-wider uppercase text-[#6b7280]">{slide.role}</span>
                            <p className="text-xs font-semibold text-[#374151] leading-5">{slide.description}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    {readyParams.structurePreview!.length > 4 && (
                      <p className="pl-2 text-[10px] font-bold text-[#9ca3af]">
                        {t('flow_note', { count: readyParams.structurePreview!.length - 4 })}
                      </p>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </motion.div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-5 relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-transparent blur-[60px] pointer-events-none" />
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-[#e5e7eb] shadow-sm"
            >
              <Compass className="h-6 w-6 text-[#6b7280] animate-[spin_12s_linear_infinite]" />
            </motion.div>
            <div className="relative z-10 space-y-2">
              <p className="text-sm font-black text-[#111111]">{t('director_waiting')}</p>
              <p className="text-xs leading-5 text-[#6b7280] font-semibold max-w-[240px] mx-auto">
                {t('director_waiting_desc')}
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-[#e5e7eb] px-5 py-4 bg-white text-center shrink-0">
          <p className="text-[10px] text-[#9ca3af] leading-relaxed font-semibold">
            Shuffla AI Content Strategy Engine v2.0
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Role label map ────────────────────────────────────────────────

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
