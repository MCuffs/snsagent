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
  ExternalLink,
  Newspaper,
  AlertCircle
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
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface DisplayMessage {
  id: string
  role: 'ai' | 'user'
  content: string
  revealedContent: string
  isTyping: boolean
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
}

let msgCounter = 0
function mkId() { return `m-${++msgCounter}` }

function aiDisplay(content: string): DisplayMessage {
  return { id: mkId(), role: 'ai', content, revealedContent: '', isTyping: true }
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

export default function GenerateForm({ brand }: GenerateFormProps) {
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

  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([])
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isWaiting, setIsWaiting] = useState(true)
  const [isRevealingMessage, setIsRevealingMessage] = useState(false)
  const [readyParams, setReadyParams] = useState<GenerateParams | null>(null)
  const [briefingStage, setBriefingStage] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [referenceFiles, setReferenceFiles] = useState<File[]>([])

  const generationMode = brand.websiteUrl === 'general_profile' ? 'general' : 'brand'
  const rssCategory = (brand.websiteUrl === 'general_profile' && brand.industry)
    ? (brand.industry as 'current-affairs' | 'information' | 'trends')
    : 'current-affairs'
  const [selectedArticle, setSelectedArticle] = useState<{ title: string; description: string; link: string; pubDate: string; isFallback?: boolean } | null>(null)
  const [rssStatus, setRssStatus] = useState<'idle' | 'fetching' | 'matched' | 'no_match_fallback' | 'error'>('idle')

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const typingTimerRef = useRef<number | null>(null)
  const briefingTimersRef = useRef<number[]>([])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayMessages])

  useEffect(() => {
    if (!generating) return
    loadingIntervalRef.current = setInterval(() => {
      setLoadingStep(prev => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev))
    }, 4000)
    return () => { if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current) }
  }, [generating])

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

  const appendAiMessage = useCallback((content: string, params?: GenerateParams) => {
    clearTypingTimer()
    const message = aiDisplay(content)
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

  const callAgent = useCallback(async (history: ChatMessage[]) => {
    setIsWaiting(true)
    try {
      const res = await fetch('/api/agents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, brandId: brand.id, language, generationMode }),
      })
      const data = await res.json() as { message?: string; ready?: boolean; params?: GenerateParams; error?: string }

      if (data.error) {
        appendAiMessage(locale === 'en' ? 'An error occurred while processing your request. Please try again.' : '요청을 처리하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
        return
      }

      const msg = data.message || (locale === 'en' ? 'Please try again.' : '다시 시도해주세요.')
      appendAiMessage(msg, data.ready && data.params ? data.params : undefined)

      const assistantHistory: ChatMessage = { role: 'assistant', content: msg }
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

  // Automated RSS Feed Matching & Briefing (General Mode only)
  useEffect(() => {
    if (generationMode !== 'general') return

    let active = true
    const searchAndBrief = async () => {
      setRssStatus('fetching')
      setIsWaiting(true)

      const greeting = locale === 'en'
        ? `Hello! Let's draft your card news. I am scanning the latest feeds for keywords: "${brand.forbiddenWords || 'all'}"...`
        : `안녕하세요! 카드뉴스 기획을 시작합니다. 설정하신 관심 키워드("${brand.forbiddenWords || '전체'}")에 맞춰 최신 뉴스를 탐색하고 있습니다...`
      
      appendAiMessage(greeting)
      const currentHistory: ChatMessage[] = [{ role: 'assistant', content: greeting }]
      setChatHistory(currentHistory)

      try {
        const res = await fetch(`/api/rss?category=${rssCategory}`)
        if (!res.ok) throw new Error('RSS fetch failed')
        const data = await res.json() as { articles?: Array<{ title: string; description: string; link: string; pubDate: string }> }
        
        if (!active) return
        const articles = data.articles || []
        
        if (articles.length === 0) {
          setRssStatus('error')
          appendAiMessage(locale === 'en' 
            ? 'No latest news articles could be fetched at this moment. Please try entering a topic manually in the chat.' 
            : '현재 최신 뉴스를 수집해오지 못했습니다. 채팅창에 원하시는 주제를 직접 입력해 주시면 기획을 도와드리겠습니다.')
          setIsWaiting(false)
          return
        }

        const keywords = (brand.forbiddenWords || '')
          .split(',')
          .map(k => k.trim())
          .filter(k => k.length > 0)

        let bestArticle = articles[0]
        let maxScore = 0
        let isFallback = true

        if (keywords.length > 0) {
          articles.forEach(art => {
            let score = 0
            const searchField = `${art.title} ${art.description}`.toLowerCase()
            keywords.forEach(keyword => {
              const kw = keyword.toLowerCase()
              const occurrences = searchField.split(kw).length - 1
              score += occurrences
            })
            if (score > maxScore) {
              maxScore = score
              bestArticle = art
              isFallback = false
            }
          })
        }

        setSelectedArticle({ ...bestArticle, isFallback })
        setRssStatus(isFallback ? 'no_match_fallback' : 'matched')

        const userPrompt = locale === 'en'
          ? `[Auto-collected News] ${bestArticle.title}\nDescription: ${bestArticle.description}\nLink: ${bestArticle.link}\n\nBased on this article, please plan the current affairs/info card news.`
          : `[자동 수집된 뉴스] ${bestArticle.title}\n기사 설명: ${bestArticle.description}\n기사 주소: ${bestArticle.link}\n\n이 기사 내용을 바탕으로 시사/정보 카드뉴스를 기획해줘.`

        setDisplayMessages(prev => [...prev, userDisplay(bestArticle.title)])
        const nextHistory: ChatMessage[] = [...currentHistory, { role: 'user', content: userPrompt }]
        setChatHistory(nextHistory)

        await callAgent(nextHistory)
      } catch (err) {
        if (!active) return
        setRssStatus('error')
        appendAiMessage(locale === 'en'
          ? 'Failed to fetch RSS feeds. Please write your card news topic directly in the chat.'
          : 'RSS 뉴스를 가져오는 데 실패했습니다. 원하시는 카드뉴스 주제를 채팅창에 직접 작성해 주시면 생성을 진행하겠습니다.')
        setIsWaiting(false)
      }
    }

    const timer = setTimeout(() => {
      void searchAndBrief()
    }, 150)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [generationMode, rssCategory, brand.forbiddenWords, locale, appendAiMessage, callAgent])

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || isWaiting || isRevealingMessage) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const newHistory = [...chatHistory, userMsg]

    setDisplayMessages(prev => [...prev, userDisplay(text)])
    setChatHistory(newHistory)
    setInput('')
    setReadyParams(null)
    setBriefingStage(0)
    clearBriefingTimers()

    await callAgent(newHistory)
  }

  const handleGenerate = async () => {
    if (!readyParams) return
    setLoadingStep(0)
    setGenerating(true)
    setError(null)

    timeEvent('generate_complete')
    analytics.generateStart({
      brandId: brand.id,
      slideCount: readyParams.slideCount,
      platform: 'card_news',
      intent: readyParams.objective,
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
          setGenerating(false)
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
          productImageUrls,
          language,
          generationMode,
        }),
      })

      const data = await res.json() as { campaignId?: string; error?: string }
      if (!res.ok || data.error) {
        analytics.generateFailed(brand.id, data.error || 'api_error')
        setError(data.error || t('error_generate'))
        setGenerating(false)
        return
      }

      analytics.generateComplete({
        brandId: brand.id,
        campaignId: data.campaignId ?? '',
        slideCount: readyParams.slideCount,
        durationMs: 0,
      })
      router.push(`/campaign/${data.campaignId}`)
    } catch {
      analytics.generateFailed(brand.id, 'network_error')
      setError(t('error_network'))
      setGenerating(false)
    }
  }

  const selectReferenceFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length > 4) {
      setError(t('error_max_images'))
      return
    }
    setReferenceFiles(files)
    if (files.length > 0) analytics.productImageAdd(files.length)
    setError(null)
  }

  // ── Generating overlay ──────────────────────────────────────────
  if (generating) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-[#FFFDF9] via-[#FAF7F2] to-[#FAF8F5] px-6 py-16 text-[#2C1E1A] relative overflow-hidden">
        {/* Glow ambient background bubbles */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#E8DCCB]/20 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-[#C2A794]/15 blur-[100px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={smoothTransition}
          className="w-full max-w-md bg-white/75 backdrop-blur-md border border-[#EFEAE2] rounded-3xl p-8 shadow-[0_12px_40px_rgba(158,125,104,0.06),_0_2px_4px_rgba(158,125,104,0.02)] text-center relative z-10"
        >
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="mb-6 flex justify-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#9E7D68]/10 to-[#C4A38E]/20 border border-[#9E7D68]/20 shadow-[0_8px_24px_rgba(158,125,104,0.06)]">
              <Sparkles className="h-6 w-6 text-[#9E7D68]" />
            </div>
          </motion.div>
          <h2 className="text-xl font-black tracking-[-0.03em] text-[#2C1E1A]">{t('building_title')}</h2>
          <p className="mt-3 text-sm text-[#8C7E7A] font-semibold leading-6 min-h-[48px] px-2">{LOADING_STEPS[loadingStep]}</p>
          <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-[#F2EAE1]">
            <motion.div
              className="h-full bg-gradient-to-r from-[#C29B84] to-[#9E7D68]"
              animate={{ width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%` }}
              transition={{ duration: 3.5, ease: 'easeInOut' }}
            />
          </div>
          <p className="mt-4 text-xs text-[#C2B5AA] font-bold">{t('wait_msg')}</p>
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
                <div className="rounded-2xl border border-[#E6DFD5] bg-[#FFFDFB] p-4.5 space-y-3.5 shadow-[0_6px_24px_rgba(158,125,104,0.04)]">
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
                  onClick={handleGenerate}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#9E7D68] to-[#8C6B56] hover:to-[#7E5E4A] py-4 text-sm font-black text-white transition-all hover:shadow-[0_8px_24px_rgba(158,125,104,0.25)] active:scale-[0.99]"
                >
                  <Sparkles className="h-4 w-4 text-[#FFFDF8]" />
                  {t('generate_cta')}
                  <ArrowRight className="h-4 w-4" />
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

            {/* 3. Slide Flow Preview */}
            {briefingStage >= 3 && readyParams.structurePreview && readyParams.structurePreview.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: [0.19, 1, 0.22, 1] }}
                className="space-y-4 pt-2"
              >
                <h4 className="text-xs font-black uppercase tracking-wider text-[#A69282] flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-[#B88E76]" /> {t('flow_section')}
                </h4>
                <div className="relative border-l border-dashed border-[#E5DDD3] pl-5 ml-2.5 space-y-5">
                  {compactSlidePreview(readyParams.structurePreview).map((slide, idx) => (
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
                {readyParams.structurePreview.length > 4 && (
                  <p className="pl-2 text-[10px] font-bold text-[#A69282]">
                    {t('flow_note', { count: readyParams.structurePreview.length - 4 })}
                  </p>
                )}
              </motion.div>
            )}
          </motion.div>
        ) : generationMode === 'general' ? (
          <div className="flex-1 flex flex-col min-h-0 bg-[#F5F1E9]/50 p-5 space-y-6">
            <div className="rounded-2xl border border-[#EFEAE2] bg-white p-5 space-y-4 shadow-[0_4px_20px_rgba(158,125,104,0.03)]">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#A69282] flex items-center gap-1.5 border-b border-[#F5EFE6] pb-3">
                <Newspaper className="h-4 w-4 text-[#B88E76]" />
                {locale === 'en' ? 'Auto-Collected News' : '자동 수집된 시사 기사'}
              </h4>

              {rssStatus === 'fetching' && (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <Compass className="h-8 w-8 text-[#9E7D68] animate-spin" />
                  <p className="text-xs font-bold text-[#8C7E7A]">
                    {locale === 'en' ? 'Searching for matching news...' : '키워드 매칭 뉴스 탐색 중...'}
                  </p>
                </div>
              )}

              {(rssStatus === 'matched' || rssStatus === 'no_match_fallback') && selectedArticle && (
                <div className="space-y-4">
                  {rssStatus === 'no_match_fallback' && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold text-amber-800 leading-relaxed">
                      ⚠️ {locale === 'en'
                        ? 'No direct match found for your keywords. Loaded the latest news from the category instead.'
                        : '관심 키워드와 직접 매치되는 최신 뉴스가 없어, 해당 분야의 가장 최신 뉴스를 가져왔습니다.'}
                    </div>
                  )}
                  {rssStatus === 'matched' && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-semibold text-emerald-800 leading-relaxed">
                      ✨ {locale === 'en'
                        ? 'Automatically matched a news article matching your profile keywords!'
                        : '설정하신 관심 키워드와 가장 매칭률이 높은 최신 뉴스를 감지했습니다.'}
                    </div>
                  )}

                  <div className="space-y-2">
                    <h5 className="text-sm font-black text-[#2C1E1A] leading-relaxed font-black">
                      {selectedArticle.title}
                    </h5>
                    {selectedArticle.description && (
                      <p className="text-xs text-[#8C7E7A] font-semibold leading-relaxed">
                        {selectedArticle.description}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between items-center border-t border-[#F5EFE6] pt-3 text-[10px] text-[#C2B5AA] font-bold">
                    <span>
                      {selectedArticle.pubDate ? new Date(selectedArticle.pubDate).toLocaleDateString(locale === 'en' ? 'en-US' : 'ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : ''}
                    </span>
                    <a
                      href={selectedArticle.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#9E7D68] hover:text-[#2C1E1A] transition-colors"
                    >
                      {locale === 'en' ? 'Read Source' : '기사 원문 보기'}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}

              {rssStatus === 'error' && (
                <div className="py-6 text-center space-y-2 text-[#8C7E7A]">
                  <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
                  <p className="text-xs font-bold">
                    {locale === 'en' ? 'Failed to auto-collect news.' : '기사 자동 수집에 실패했습니다.'}
                  </p>
                  <p className="text-[10px] text-[#C2B5AA] font-semibold">
                    {locale === 'en' ? 'Please enter your topic in the chat.' : '채팅창에서 카드뉴스 주제를 직접 입력해주세요.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-5 relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-[#E8DCCB]/25 blur-[60px] pointer-events-none" />
            <motion.div
              animate={{
                y: [0, -6, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
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
