'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
  nicepayClientKey?: string
  nicepayReturnTokens?: Record<string, string>
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
}

interface CopyPreviewSlide {
  slideNumber: number
  role: string
  headline: string
  body: string
}

let msgCounter = 0
function mkId() { return `m-${++msgCounter}` }

function aiDisplay(content: string, clarification?: ClarificationPrompt): DisplayMessage {
  return { id: mkId(), role: 'ai', content, revealedContent: '', isTyping: true, clarification }
}

function userDisplay(content: string): DisplayMessage {
  return { id: mkId(), role: 'user', content, revealedContent: content, isTyping: false }
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
  userId,
  userEmail,
  userName,
  nicepayClientKey,
  nicepayReturnTokens,
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

  // Promo payment modal states
  const [showPromoModal, setShowPromoModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<'PRO' | 'UNLIMITED'>('PRO')
  const [processingPayment, setProcessingPayment] = useState(false)
  const [promoError, setPromoError] = useState<string | null>(null)

  const generating = phase === 'generating'

  const generationMode = brand.websiteUrl === 'general_profile' ? 'general' : 'brand'

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const typingTimerRef = useRef<number | null>(null)
  const briefingTimersRef = useRef<number[]>([])
  const generationStartedAtRef = useRef<number | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayMessages])

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

  const callAgent = useCallback(async (history: ChatMessage[]) => {
    setIsWaiting(true)
    try {
      const res = await fetch('/api/agents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, brandId: brand.id, language, generationMode }),
      })
      const data = await res.json() as { message?: string; ready?: boolean; params?: GenerateParams; clarification?: ClarificationPrompt; error?: string }

      if (data.error) {
        appendAiMessage(locale === 'en' ? 'An error occurred while processing your request. Please try again.' : '요청을 처리하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
        return
      }

      const msg = data.message || (locale === 'en' ? 'Please try again.' : '다시 시도해주세요.')
      appendAiMessage(msg, data.params ? data.params : undefined, !data.ready ? data.clarification : undefined)
      if (data.ready && data.params) {
        analytics.generateBriefReady({
          brandId: brand.id,
          generationMode,
          topic: data.params.topic,
          contentType: data.params.contentType,
          objective: data.params.objective,
          slideCount: data.params.slideCount,
          hasProductUrl: Boolean(data.params.productUrl),
          structureSlideCount: data.params.structurePreview?.length ?? 0,
          locale,
        })
      }

      const clarificationContext = data.clarification
        ? [
            '',
            `[Clarification question shown to user] ${data.clarification.question}`,
            '[Clarification options]',
            ...data.clarification.options.map(option => `- ${option.label}: ${option.value}`),
          ].join('\n')
        : ''
      const assistantHistory: ChatMessage = { role: 'assistant', content: `${msg}${clarificationContext}` }
      setChatHistory(prev => [...prev, assistantHistory])
    } catch {
      appendAiMessage(locale === 'en' ? 'Failed to connect to server. Please try again.' : '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsWaiting(false)
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
        const data = await res.json() as { message?: string; error?: string }
        if (!active) return
        const msg = data.error ? (locale === 'en' ? 'An error occurred. Please try again.' : '오류가 발생했습니다. 다시 시도해주세요.') : (data.message || (locale === 'en' ? 'Please try again.' : '다시 시도해주세요.'))
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

    const userMsg: ChatMessage = { role: 'user', content: text }
    const newHistory = [...chatHistory, userMsg]

    setDisplayMessages(prev => [...prev, userDisplay(text)])
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

  const handleClarificationSelect = async (option: ClarificationOption | null) => {
    if (isWaiting || isRevealingMessage) return

    const text = option
      ? option.value
      : (locale === 'en'
        ? 'Proceed with the current information and choose the best concrete direction yourself.'
        : '현재 정보만으로 가장 적절한 구체 방향을 선택해서 진행해 주세요.')
    const userLabel = option?.label || (locale === 'en' ? 'Use current info' : '현재 정보로 진행')
    const userMsg: ChatMessage = { role: 'user', content: text }
    const newHistory = [...chatHistory, userMsg]

    setDisplayMessages(prev => [...prev, userDisplay(userLabel)])
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

  const handlePromoPayment = async (
    planKey: 'PRO' | 'UNLIMITED',
    cardData: { cardNo: string; cardExpire: string; idNo: string; cardPw: string }
  ) => {
    if (!nicepayReturnTokens || !nicepayClientKey) {
      setPromoError('결제 환경 설정이 누락되었습니다.')
      return
    }
    const returnToken = nicepayReturnTokens[planKey]
    if (!returnToken) {
      setPromoError('결제 토큰을 생성할 수 없습니다.')
      return
    }

    setPromoError(null)
    setProcessingPayment(true)

    const PLAN_AMOUNTS: Record<string, number> = { PRO: 25000, UNLIMITED: 39000 }
    const originalAmount = PLAN_AMOUNTS[planKey] ?? 0
    const amount = Math.round(originalAmount * 0.8)
    const orderId = `shuffla_regist_promo_${Date.now()}_${planKey}`

    analytics.planSelectClick(planKey, 'FREE', {
      payment_provider: 'nicepay',
      amount,
      currency: 'KRW',
      is_promo: true,
    })
    analytics.paymentStart(planKey, 'nicepay', {
      amount,
      currency: 'KRW',
      order_id: orderId,
      is_promo: true,
    })

    try {
      const [encodedPayload] = returnToken.split('.')
      if (!encodedPayload) {
        throw new Error('Invalid payment token format')
      }

      const decodeBase64Url = (str: string) => {
        let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
        while (base64.length % 4) {
          base64 += '='
        }
        return atob(base64)
      }

      const payloadObj = JSON.parse(decodeBase64Url(encodedPayload))
      const encryptionKey = payloadObj.encryptionKey
      if (!encryptionKey) {
        throw new Error('Encryption key missing from payment token')
      }

      const plaintext = `cardNo=${cardData.cardNo}&cardExpire=${cardData.cardExpire}&idNo=${cardData.idNo}&cardPw=${cardData.cardPw}`
      const { ciphertext, iv } = await encryptCardDataClient(plaintext, encryptionKey)

      const res = await fetch('/api/nicepay/card-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: returnToken,
          ciphertext,
          iv,
          plan: planKey,
          isPromo: true,
        }),
      })

      const responseData = await res.json() as { error?: string }

      if (!res.ok) {
        analytics.paymentFailed(planKey, 'nicepay', responseData.error || 'api_error', {
          amount,
          currency: 'KRW',
          order_id: orderId,
        })
        setPromoError(responseData.error || '결제 승인에 실패했습니다.')
        setProcessingPayment(false)
      } else {
        analytics.paymentSuccess(planKey, 'nicepay', {
          amount,
          currency: 'KRW',
          order_id: orderId,
          is_promo: true,
        })
        setShowPromoModal(false)
        setProcessingPayment(false)
        router.refresh()
        
        // Wait 1.5s for session to update plan, then resume campaign generation automatically
        setTimeout(() => {
          void handleGenerate(copyPreviewSlides)
        }, 1500)
      }
    } catch (err) {
      console.error('Promo payment registration error:', err)
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
            onSubmit={handlePromoPayment}
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
      <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-[#FFFDF9] via-[#FAF7F2] to-[#FAF8F5] px-6 py-16 text-[#2C1E1A] relative overflow-hidden">
        {/* Glow ambient background bubbles */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#E8DCCB]/20 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-[#C2A794]/15 blur-[100px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={smoothTransition}
          className="w-full max-w-lg bg-white/80 backdrop-blur-md border border-[#EFEAE2] rounded-[32px] p-8 shadow-[0_24px_60px_rgba(158,125,104,0.08),_0_4px_12px_rgba(158,125,104,0.02)] relative z-10"
        >
          <div className="text-center mb-8">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              className="mb-4 inline-flex"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#9E7D68]/10 to-[#C4A38E]/20 border border-[#9E7D68]/20 shadow-[0_8px_24px_rgba(158,125,104,0.06)]">
                <Sparkles className="h-5 w-5 text-[#9E7D68]" />
              </div>
            </motion.div>
            <h2 className="text-2xl font-black tracking-[-0.03em] text-[#2C1E1A]">{t('building_title')}</h2>
            <p className="mt-2 text-xs text-[#C2B5AA] font-bold">{t('wait_msg')}</p>
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
                      ? 'bg-white border-2 border-[#9E7D68] shadow-[0_12px_24px_rgba(158,125,104,0.06)] text-[#2C1E1A]'
                      : 'bg-[#FCFBF9]/30 border-[#EFEAE2]/60 text-gray-400 opacity-55'
                  }`}
                >
                  {/* Timeline Connector Line */}
                  {idx < LOADING_STEPS.length - 1 && (
                    <div 
                      className={`absolute left-7 top-14 w-[2px] h-[34px] -translate-x-1/2 z-0 transition-colors duration-500 ${
                        isCompleted ? 'bg-emerald-400' : 'bg-[#EFEAE2]'
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
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#9E7D68] text-white shadow-[0_2px_8px_rgba(158,125,104,0.2)]">
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
                      isCompleted ? 'text-emerald-900' : isCurrent ? 'text-[#2C1E1A]' : 'text-gray-400'
                    }`}>
                      {LOADING_STEP_TITLES[idx]}
                    </h4>
                    <p className={`mt-1.5 text-xs leading-5 font-semibold ${
                      isCompleted ? 'text-emerald-700/80' : isCurrent ? 'text-[#8C7E7A]' : 'text-gray-400/70'
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
      className="flex h-full overflow-hidden bg-gradient-to-br from-[#FCFBF9] via-[#FAF7F2] to-[#FAF5EE]"
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
          background: #E5DDD3;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #C4BCAE;
        }
      ` }} />

      {/* Chat panel */}
      <motion.div
        variants={formItemVariants}
        className="flex min-w-0 flex-1 flex-col bg-[#FFFDFB]/80 backdrop-blur-sm border-r border-[#EFEAE2]"
      >
        {/* Header containing Brand chip & Mode Label */}
        <div className="shrink-0 border-b border-[#EFEAE2] px-5 py-3.5 bg-[#FCFBF9]/60 flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E5DDD3] bg-white px-3 py-1.5 text-xs font-bold text-[#5C4E4B] shadow-[0_2px_8px_rgba(158,125,104,0.04)]">
            <span className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ backgroundColor: brand.mainColor || '#9E7D68' }} />
            {brand.name}
          </div>
          
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5DDD3] bg-[#F2EAE1] px-3.5 py-1.5 text-xs font-black text-[#5C4E4B] shadow-sm">
            {generationMode === 'general' ? t('mode_general') : t('mode_brand')}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5 custom-scrollbar" aria-live="polite">
          {/* Initial loading skeleton */}
          {displayMessages.length === 0 && isWaiting && (
            <div className="flex justify-start">
              <div className="flex flex-col gap-2.5 items-start">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-[#9E7D68] to-[#C4A38E] text-[10px] font-black text-white shadow-sm ring-1 ring-white/20">S</div>
                <div className="rounded-2xl rounded-tl-sm bg-[#FDFBF7] border border-[#E6DFD5] px-4 py-2.5 shadow-[0_4px_18px_rgba(212,197,185,0.08)]">
                  <div className="flex gap-1.5 py-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#C4A38E]" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#C4A38E]" style={{ animationDelay: '120ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#C4A38E]" style={{ animationDelay: '240ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {displayMessages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8, filter: 'blur(3px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.45, ease: [0.19, 1, 0.22, 1] }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex max-w-[85%] flex-col gap-2.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.role === 'ai' && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-[#9E7D68] to-[#C4A38E] text-[10px] font-black text-white shadow-sm ring-1 ring-white/20">
                      S
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-6 font-medium whitespace-pre-line ${
                      msg.role === 'user'
                        ? 'rounded-tr-sm bg-gradient-to-br from-[#6B5D57] to-[#5C4E4B] text-white shadow-[0_4px_16px_rgba(94,82,77,0.12)]'
                        : 'rounded-tl-sm bg-[#FDFBF7] text-[#2C1E1A] border border-[#E6DFD5] shadow-[0_4px_18px_rgba(212,197,185,0.08)]'
                    }`}
                  >
                    {msg.role === 'ai' ? msg.revealedContent : msg.content}
                    {msg.role === 'ai' && msg.isTyping && (
                      <span className="ml-0.5 inline-block h-[1em] w-px align-middle bg-[#B88E76] animate-pulse" />
                    )}
                  </div>
                  {msg.role === 'ai' && msg.clarification && !msg.isTyping && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, ease: [0.19, 1, 0.22, 1] }}
                      className="w-full rounded-2xl border border-[#E0D7CC] bg-white/95 p-3.5 shadow-[0_10px_30px_rgba(158,125,104,0.08)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-black leading-6 text-[#2C1E1A]">{msg.clarification.question}</p>
                        <button
                          type="button"
                          onClick={() => handleClarificationSelect(null)}
                          disabled={isWaiting || isRevealingMessage}
                          className="shrink-0 rounded-full p-1 text-[#8C7E7A] transition-colors hover:bg-[#F2EAE1] disabled:opacity-40"
                          aria-label={locale === 'en' ? 'Skip question' : '질문 건너뛰기'}
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
                            className="group flex w-full items-center gap-3 rounded-xl border border-transparent bg-[#F7F4EF] px-3 py-3 text-left transition-all hover:border-[#C9B29F] hover:bg-[#FFFDFB] disabled:opacity-50"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-black text-[#8C7E7A] shadow-sm group-hover:text-[#9E7D68]">
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1 text-sm font-bold leading-5 text-[#3B302C]">{option.label}</span>
                            <ArrowRight className="h-4 w-4 shrink-0 text-[#A69282] opacity-0 transition-opacity group-hover:opacity-100" />
                          </button>
                        ))}
                      </div>
                      {msg.clarification.allowCustom && (
                        <p className="mt-3 text-[11px] font-semibold text-[#9A8C80]">
                          {locale === 'en' ? 'Or type your own answer in the input below.' : '또는 아래 입력창에 직접 답변해도 됩니다.'}
                        </p>
                      )}
                      {msg.clarification.skipLabel && (
                        <button
                          type="button"
                          onClick={() => handleClarificationSelect(null)}
                          disabled={isWaiting || isRevealingMessage}
                          className="mt-3 rounded-xl border border-[#D8CEC1] bg-white px-3 py-2 text-xs font-black text-[#5C4E4B] transition hover:border-[#9E7D68] disabled:opacity-40"
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

          {/* AI typing indicator */}
          {isWaiting && displayMessages.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={smoothTransition}
              className="flex justify-start"
            >
              <div className="flex flex-col gap-2.5 items-start">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-[#9E7D68] to-[#C4A38E] text-[10px] font-black text-white shadow-sm ring-1 ring-white/20">S</div>
                <div className="rounded-2xl rounded-tl-sm bg-[#FDFBF7] px-4 py-3 border border-[#E6DFD5] shadow-[0_4px_18px_rgba(212,197,185,0.08)]">
                  <div className="flex gap-1.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#C4A38E]" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#C4A38E]" style={{ animationDelay: '120ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#C4A38E]" style={{ animationDelay: '240ms' }} />
                  </div>
                </div>
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
                <div className="rounded-2xl border border-[#E6DFD5] bg-[#FFFDFB] p-4.5 space-y-3.5 shadow-[0_6px_24px_rgba(158,125,104,0.04)]" onPaste={handlePaste}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-[#2C1E1A]">{t('attach_image')}</p>
                      <p className="text-[10px] text-[#8C7E7A] mt-0.5 font-semibold">{t('attach_image_desc')}</p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-white px-3.5 py-2.5 text-xs font-bold text-[#2C1E1A] transition-all hover:border-[#9E7D68] hover:bg-[#FFFDFB] shadow-sm active:scale-98">
                      <ImagePlus className="h-3.5 w-3.5 text-[#9E7D68]" />
                      {t('select_file')}
                      <input type="file" accept="image/*" multiple className="hidden" onChange={selectReferenceFiles} />
                    </label>
                  </div>
                  {referenceFiles.length === 0 && (
                    <p className="text-[10px] text-[#B8AEA4] text-center py-1">{t('paste_hint')}</p>
                  )}
                  {referenceFiles.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {referenceFiles.map((file) => (
                        <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-2 text-xs text-[#5C4E4B] bg-[#FDFBF7] border border-[#EBE2D9] rounded-xl px-3 py-1.5 shadow-sm">
                          <span className="truncate font-bold">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => setReferenceFiles(current => current.filter(item => item !== file))}
                            className="rounded-full p-1 text-[#8C7E7A] hover:bg-[#EBE2D9]/50 transition-colors"
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
                  className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#9E7D68] to-[#8C6B56] hover:to-[#7E5E4A] py-4 text-sm font-black text-white transition-all hover:shadow-[0_8px_24px_rgba(158,125,104,0.25)] active:scale-[0.99] disabled:opacity-60"
                >
                  {previewLoading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      {t('copy_preview_generating')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-[#FFFDF8]" />
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
        <div className="shrink-0 border-t border-[#EFEAE2] bg-[#FCFBF9]/80 backdrop-blur-md px-4 py-3.5">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={readyParams ? t('feedback_placeholder') : t('input_placeholder')}
              disabled={isWaiting || isRevealingMessage}
              className="h-12 flex-1 rounded-2xl border border-[#E6DFD5] bg-white px-4 text-sm text-[#2C1E1A] placeholder-[#C2B5AA] outline-none focus:border-[#9E7D68] focus:ring-2 focus:ring-[#9E7D68]/5 disabled:opacity-50 font-bold transition-all"
              autoFocus
            />
            <button
              type="submit"
              disabled={!input.trim() || isWaiting || isRevealingMessage}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-[#9E7D68] to-[#8C6B56] text-white transition-all hover:to-[#7E5E4A] hover:shadow-[0_4px_12px_rgba(158,125,104,0.2)] disabled:opacity-30 active:scale-95 shadow-sm"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </motion.div>

      {/* AI Strategy Director Panel (hidden on mobile) */}
      <motion.div
        variants={formItemVariants}
        className="hidden w-[390px] shrink-0 flex-col bg-gradient-to-b from-[#FCFBF9] to-[#F5F1E9] text-[#2C1E1A] border-l border-[#EFEAE2] overflow-y-auto xl:flex custom-scrollbar"
      >
        <div className="border-b border-[#EFEAE2] px-5 py-5 bg-[#FCFBF9]/90 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#B88E76] flex items-center gap-1">
                <Sparkle className="h-3 w-3 fill-current" /> AI Content Director
              </p>
              <h3 className="mt-1 text-base font-black tracking-tight text-[#2C1E1A]">{t('director_title')}</h3>
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
              className="rounded-2xl border border-[#EFEAE2] bg-white/80 backdrop-blur-sm p-4.5 space-y-3.5 shadow-[0_4px_20px_rgba(158,125,104,0.03)]"
            >
              <div className="flex justify-between border-b border-[#F5EFE6] pb-2.5">
                <span className="text-[11px] text-[#8C7E7A] font-bold">{t('topic_label')}</span>
                <span className="text-xs font-black text-[#2C1E1A] truncate max-w-[200px]">{readyParams.topic}</span>
              </div>
              <div className="flex justify-between border-b border-[#F5EFE6] pb-2.5">
                <span className="text-[11px] text-[#8C7E7A] font-bold">{t('visual_label')}</span>
                <span className="rounded bg-[#9E7D68]/10 border border-[#9E7D68]/20 px-2 py-0.5 text-[10px] font-black text-[#9E7D68]">
                  {readyParams.visualHint}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#F5EFE6] pb-2.5">
                <span className="text-[11px] text-[#8C7E7A] font-bold">{t('content_type_label')}</span>
                <span className="text-xs font-bold text-[#5C4E4B]">{readyParams.contentType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[11px] text-[#8C7E7A] font-bold">{t('slide_count_label')}</span>
                <span className="text-xs font-bold text-[#5C4E4B]">{t('slide_count_value', { count: readyParams.slideCount })}</span>
              </div>
              <div className="rounded-xl bg-[#F8F4EE] px-3 py-3">
                <span className="block text-[10px] font-bold text-[#A69282] mb-1">{t('objective_label')}</span>
                <p className="text-xs font-semibold leading-5 text-[#5C4E4B]">{readyParams.objective}</p>
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
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#A69282] flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5 text-[#B88E76]" /> {t('hook_section')}
                  </h4>
                  <div className="bg-white/80 backdrop-blur-sm border border-[#EFEAE2] rounded-2xl p-4 space-y-3 shadow-[0_4px_16px_rgba(158,125,104,0.02)]">
                    {readyParams.hookDirection && (
                      <div>
                        <span className="block text-[9px] font-bold text-[#A69282]">{t('hook_label')}</span>
                        <p className="text-xs font-bold text-[#2C1E1A] mt-1 leading-5">{readyParams.hookDirection}</p>
                      </div>
                    )}
                    {readyParams.recommendedCta && (
                      <div className="border-t border-[#F5EFE6] pt-3">
                        <span className="block text-[9px] font-bold text-[#A69282]">{t('cta_label')}</span>
                        <p className="text-xs font-bold text-[#C68D6A] mt-1">{readyParams.recommendedCta}</p>
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
                <h4 className="text-xs font-black uppercase tracking-wider text-[#A69282] flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-[#B88E76]" />
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
                        className="relative bg-white/90 border border-[#EFEAE2] rounded-2xl p-4.5 shadow-[0_3px_12px_rgba(158,125,104,0.03)] space-y-2.5 hover:border-[#C4A38E] transition-all"
                      >
                        <div className="flex items-center justify-between border-b border-[#F5EFE6] pb-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#2C1E1A] text-[10px] font-black text-[#FFFDF8] shadow-sm">
                            {slide.slideNumber}
                          </span>
                          <span className="rounded-full border border-[#E8DCCB] bg-[#F8F4EE] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#9E7D68]">
                            {slide.role}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs font-black leading-5 text-[#2C1E1A]">{slide.headline}</p>
                          <p className="text-[11px] font-medium leading-relaxed text-[#5C4E4B]">{slide.body}</p>
                        </div>
                        {slide.reasoning && (
                          <div className="border-t border-[#F5EFE6] pt-2 mt-1">
                            <span className="block text-[8px] font-black text-[#B88E76] uppercase tracking-[0.12em]">{locale === 'en' ? 'Reasoning' : '디렉터 기획 의도'}</span>
                            <p className="text-[10px] text-[#8C7E7A] leading-relaxed mt-0.5 font-semibold">{slide.reasoning}</p>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="relative border-l border-dashed border-[#E5DDD3] pl-5 ml-2.5 space-y-5">
                      {compactSlidePreview(readyParams.structurePreview!).map((slide, idx) => (
                        <motion.div 
                          key={slide.slideNumber}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1], delay: idx * 0.08 + 0.3 }}
                          className="relative"
                        >
                          <span className="absolute -left-[30px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#FAF8F5] border-2 border-[#9E7D68] text-[10px] font-black text-[#9E7D68] shadow-[0_2px_4px_rgba(158,125,104,0.1)]">
                            {slide.slideNumber}
                          </span>
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-black tracking-wider uppercase text-[#B88E76]">{slide.role}</span>
                            <p className="text-xs font-semibold text-[#5C4E4B] leading-5">{slide.description}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    {readyParams.structurePreview!.length > 4 && (
                      <p className="pl-2 text-[10px] font-bold text-[#A69282]">
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
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-[#E8DCCB]/25 blur-[60px] pointer-events-none" />
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-[#E6DFD5] shadow-[0_8px_24px_rgba(158,125,104,0.06)]"
            >
              <Compass className="h-6 w-6 text-[#B88E76] animate-[spin_12s_linear_infinite]" />
            </motion.div>
            <div className="relative z-10 space-y-2">
              <p className="text-sm font-black text-[#2C1E1A]">{t('director_waiting')}</p>
              <p className="text-xs leading-5 text-[#8C7E7A] font-semibold max-w-[240px] mx-auto">
                {t('director_waiting_desc')}
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-[#EFEAE2] px-5 py-4 bg-[#FCFBF9] text-center shrink-0">
          <p className="text-[10px] text-[#A69282] leading-relaxed font-semibold">
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
    <div className="flex h-full flex-col bg-gradient-to-br from-[#FFFDFB] via-[#FAF7F2] to-[#F5F1E9] text-[#2C1E1A]">
      {/* Header */}
      <div className="shrink-0 border-b border-[#EFEAE2] bg-[#FFFDFB]/88 px-5 py-4 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E5DDD3] bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#9E7D68] shadow-[0_3px_12px_rgba(158,125,104,0.05)]">
              <Sparkle className="h-3 w-3" />
              Copy Desk
            </div>
            <h2 className="mt-2 text-lg font-black tracking-[-0.02em] text-[#2C1E1A]">{t('copy_preview_title')}</h2>
            <p className="mt-1 truncate text-xs font-semibold text-[#8C7E7A]">{t('copy_preview_desc')}</p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[#E5DDD3] bg-white px-3 py-2 text-xs font-black text-[#5C4E4B] shadow-sm transition-all hover:border-[#C9B29F] hover:bg-[#FFF8F1]"
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
              className="group rounded-2xl border border-[#E6DFD5] bg-[#FFFDFB]/92 p-4 shadow-[0_8px_28px_rgba(158,125,104,0.05)] transition-all focus-within:border-[#B88E76] focus-within:bg-white hover:border-[#D7C7B8] hover:bg-white"
            >
              <div className="grid gap-4 sm:grid-cols-[92px_minmax(0,1fr)]">
                <div className="flex items-center gap-2 sm:block">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2C1E1A] text-xs font-black text-[#FFFDF8] shadow-[0_8px_18px_rgba(44,30,26,0.12)]">
                    {String(slide.slideNumber).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 sm:mt-3">
                    <span className="inline-flex max-w-full rounded-full border border-[#E8DCCB] bg-[#F8F4EE] px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#9E7D68]">
                      <span className="truncate">{slide.role}</span>
                    </span>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#A69282]">
                      {locale === 'en' ? 'Headline' : '제목'}
                    </span>
                    <span className="text-[10px] font-bold text-[#C2B5AA]">{slide.headline.length}</span>
                  </div>
                  <input
                    type="text"
                    value={slide.headline}
                    onChange={(e) => updateSlide(slide.slideNumber, 'headline', e.target.value)}
                    placeholder={locale === 'en' ? 'Headline' : '제목'}
                    className="h-11 w-full rounded-xl border border-[#E6DFD5] bg-white px-3 text-base font-black tracking-[-0.01em] text-[#2C1E1A] outline-none transition-all placeholder:text-[#C2B5AA] focus:border-[#9E7D68] focus:ring-2 focus:ring-[#9E7D68]/8"
                  />
                  <div className="mt-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#A69282]">
                        {locale === 'en' ? 'Body copy' : '본문'}
                      </span>
                      <span className="text-[10px] font-bold text-[#C2B5AA]">{slide.body.length}</span>
                    </div>
                    <textarea
                      value={slide.body}
                      onChange={(e) => updateSlide(slide.slideNumber, 'body', e.target.value)}
                      placeholder={locale === 'en' ? 'Body copy' : '본문'}
                      rows={3}
                      className="min-h-[96px] w-full resize-y rounded-xl border border-[#E6DFD5] bg-white px-3 py-2.5 text-sm font-semibold leading-6 text-[#5C4E4B] outline-none transition-all placeholder:text-[#C2B5AA] focus:border-[#9E7D68] focus:ring-2 focus:ring-[#9E7D68]/8"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Image attach */}
        <div className="mx-auto mt-4 max-w-4xl rounded-2xl border border-[#E6DFD5] bg-[#FFFDFB]/92 p-4 shadow-[0_8px_28px_rgba(158,125,104,0.05)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-[#2C1E1A]">{t('attach_image')}</p>
              <p className="mt-0.5 text-[10px] font-semibold text-[#8C7E7A]">{t('attach_image_desc')}</p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-white px-3.5 py-2.5 text-xs font-black text-[#2C1E1A] shadow-sm transition-all hover:border-[#9E7D68] hover:bg-[#FFF8F1]">
              <ImagePlus className="h-3.5 w-3.5 text-[#9E7D68]" />
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
                <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-2 rounded-xl border border-[#EBE2D9] bg-[#FDFBF7] px-3 py-1.5 text-xs text-[#5C4E4B]">
                  <span className="truncate font-medium">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setReferenceFiles(prev => prev.filter(f => f !== file))}
                    className="rounded-full p-1 text-[#8C7E7A] transition-colors hover:bg-[#EBE2D9]/70"
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
      <div className="shrink-0 border-t border-[#EFEAE2] bg-[#FFFDFB]/90 px-5 py-3.5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center gap-4">
          <div className="hidden min-w-0 flex-1 sm:block">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#A69282]">
              {editedSlides.length} slides · {totalCharacters} chars
            </p>
            <p className="mt-0.5 truncate text-xs font-semibold text-[#5C4E4B]">{t('copy_preview_desc')}</p>
          </div>
          <button
            type="button"
            onClick={() => onConfirm(editedSlides)}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#2C1E1A] px-5 py-3 text-sm font-black text-[#FFFDF8] shadow-[0_14px_34px_rgba(44,30,26,0.18)] transition-all hover:bg-[#3B302C] active:scale-[0.99] sm:w-auto sm:min-w-[220px]"
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

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

async function encryptCardDataClient(plainText: string, keyBase64: string): Promise<{ ciphertext: string; iv: string }> {
  const keyBytes = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0))

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )

  const iv = window.crypto.getRandomValues(new Uint8Array(12))

  const encoder = new TextEncoder()
  const encodedText = encoder.encode(plainText)

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    cryptoKey,
    encodedText
  )

  return {
    ciphertext: toBase64(new Uint8Array(ciphertextBuffer)),
    iv: toBase64(iv),
  }
}

interface PromoPaymentModalProps {
  processing: boolean
  error: string | null
  onSubmit: (plan: 'PRO' | 'UNLIMITED', data: { cardNo: string; cardExpire: string; idNo: string; cardPw: string }) => void
  onClose: () => void
}

function PromoPaymentModal({
  processing,
  error,
  onSubmit,
  onClose,
}: PromoPaymentModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [selectedPlan, setSelectedPlan] = useState<'PRO' | 'UNLIMITED'>('PRO')
  const [cardNo, setCardNo] = useState('')
  const [cardExpire, setCardExpire] = useState('')
  const [idNo, setIdNo] = useState('')
  const [cardPw, setCardPw] = useState('')
  const [formError, setFormError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    const rawCard = cardNo.replace(/-/g, '')
    if (!/^\d{14,16}$/.test(rawCard)) { setFormError('카드번호를 올바르게 입력해 주세요.'); return }
    if (!/^\d{4}$/.test(cardExpire.replace('/', ''))) { setFormError('유효기간을 MM/YY 형식으로 입력해 주세요.'); return }
    if (!/^\d{6}(\d{4})?$/.test(idNo)) { setFormError('생년월일(6자리) 또는 사업자번호(10자리)를 입력해 주세요.'); return }
    if (!/^\d{2}$/.test(cardPw)) { setFormError('비밀번호 앞 2자리를 입력해 주세요.'); return }

    const [mm, yy] = cardExpire.split('/')
    onSubmit(selectedPlan, { cardNo: rawCard, cardExpire: `${yy}${mm}`, idNo, cardPw })
  }

  const planPrice = selectedPlan === 'PRO' ? '20,000원' : '31,200원'
  const planOriginalPrice = selectedPlan === 'PRO' ? '25,000원' : '39,000원'
  const planName = selectedPlan === 'PRO' ? 'Creator' : 'Studio'
  const planDesc = selectedPlan === 'PRO' ? '월 20회 카드뉴스 생성' : '월 30회 카드뉴스 생성'

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 py-6"
      onClick={(e) => { if (e.target === overlayRef.current && !processing) onClose() }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-[28px] shadow-[0_32px_80px_rgba(0,0,0,0.5)] flex flex-col md:flex-row">

        {/* ── 왼쪽: 이미지 배경 + 카드뉴스 감성 오버레이 ── */}
        <div
          className="relative md:w-[46%] min-h-[280px] md:min-h-0 flex-shrink-0 flex flex-col justify-between overflow-hidden"
          style={{ backgroundImage: "url('/promo-bg.png')", backgroundSize: 'cover', backgroundPosition: 'center 30%' }}
        >
          {/* 멀티 레이어 오버레이: 카드뉴스 감성 */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/50 to-black/85" />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#9E7D68]/60 via-transparent to-transparent mix-blend-multiply" />

          {/* 닫기 버튼 (left panel) */}
          <div className="relative z-10 flex justify-end p-4">
            <button
              type="button"
              onClick={onClose}
              disabled={processing}
              className="rounded-full p-1.5 bg-white/10 backdrop-blur-sm text-white/70 transition hover:bg-white/20 hover:text-white disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 카드뉴스 감성 콘텐츠 */}
          <div className="relative z-10 p-7 pb-8">
            {/* 에디토리얼 태그 */}
            <span className="inline-block rounded-full border border-white/30 bg-white/10 backdrop-blur-sm px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/80 mb-4">
              SHUFFLA · 한정 혜택
            </span>

            {/* 헤드라인 */}
            <h2 className="text-[28px] font-black leading-[1.1] tracking-[-0.04em] text-white mb-2">
              지금<br />시작하면<br /><span className="text-[#FFD580]">20% OFF</span>
            </h2>

            {/* 서브카피 */}
            <p className="text-xs font-bold text-white/70 leading-relaxed mb-5">
              무료 한도가 끝났어도<br />괜찮아요. 딱 지금만 20% 할인.
            </p>

            {/* 플랜 가격 배지 */}
            <div className="flex items-end gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-0.5">{planName} 플랜</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs text-white/40 line-through font-bold">{planOriginalPrice}</span>
                  <span className="text-2xl font-black text-[#FFD580] tracking-tight">{planPrice}</span>
                  <span className="text-xs text-white/60 font-bold">/월</span>
                </div>
                <p className="text-[10px] text-white/50 font-bold mt-0.5">{planDesc}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── 오른쪽: 결제 폼 패널 ── */}
        <div className="flex-1 bg-[#0F0D0B] flex flex-col overflow-y-auto max-h-[90vh] md:max-h-none">
          <div className="p-6 flex-1">
            {/* 플랜 선택 탭 */}
            <div className="flex gap-2 mb-6">
              {(['PRO', 'UNLIMITED'] as const).map((plan) => (
                <button
                  key={plan}
                  type="button"
                  onClick={() => setSelectedPlan(plan)}
                  disabled={processing}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black tracking-wide transition-all ${
                    selectedPlan === plan
                      ? 'bg-[#9E7D68] text-white shadow-[0_4px_16px_rgba(158,125,104,0.35)]'
                      : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
                  }`}
                >
                  {plan === 'PRO' ? 'Creator' : 'Studio'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 카드번호 */}
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-white/40">카드번호</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0000 - 0000 - 0000 - 0000"
                  maxLength={19}
                  value={cardNo}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 16)
                    setCardNo(v.replace(/(.{4})/g, '$1-').replace(/-$/, ''))
                  }}
                  disabled={processing}
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm tracking-widest text-white placeholder-white/20 outline-none focus:border-[#9E7D68]/60 focus:ring-1 focus:ring-[#9E7D68]/40 disabled:opacity-40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-white/40">유효기간</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="MM / YY"
                    maxLength={5}
                    value={cardExpire}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                      setCardExpire(v.length > 2 ? `${v.slice(0, 2)}/${v.slice(2)}` : v)
                    }}
                    disabled={processing}
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm tracking-widest text-white placeholder-white/20 outline-none focus:border-[#9E7D68]/60 focus:ring-1 focus:ring-[#9E7D68]/40 disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-white/40">비밀번호 앞 2자리</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="••"
                    maxLength={2}
                    value={cardPw}
                    onChange={(e) => setCardPw(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    disabled={processing}
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#9E7D68]/60 focus:ring-1 focus:ring-[#9E7D68]/40 disabled:opacity-40"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-white/40">
                  생년월일 <span className="normal-case font-normal text-white/25">(법인: 사업자번호 10자리)</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="YYMMDD"
                  maxLength={10}
                  value={idNo}
                  onChange={(e) => setIdNo(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  disabled={processing}
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm tracking-widest text-white placeholder-white/20 outline-none focus:border-[#9E7D68]/60 focus:ring-1 focus:ring-[#9E7D68]/40 disabled:opacity-40"
                />
              </div>

              {(formError || error) && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-400">
                  {formError || error}
                </p>
              )}

              {/* 결제 버튼 */}
              <button
                type="submit"
                disabled={processing}
                className="w-full rounded-2xl bg-gradient-to-br from-[#9E7D68] to-[#7A5E4E] py-4 text-sm font-black text-white shadow-[0_8px_28px_rgba(158,125,104,0.4)] transition-all hover:shadow-[0_12px_36px_rgba(158,125,104,0.5)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 mt-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    결제 처리 중...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    {planPrice} 결제 후 즉시 생성
                  </>
                )}
              </button>

              <p className="text-[10px] text-white/20 text-center leading-relaxed pt-1">
                첫 달만 20% 할인 · 다음 달부터 정상 요금 · 언제든 해지 가능<br />
                카드 정보는 AES-256 암호화 처리됩니다
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

