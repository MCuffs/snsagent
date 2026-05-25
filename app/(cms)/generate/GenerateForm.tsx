'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, SkipForward, Sparkles } from 'lucide-react'

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
}

interface GenerateFormProps {
  brand: Brand
}

type Stage = 'topic' | 'goal' | 'url' | 'slides' | 'confirm' | 'generating' | 'done'

interface Message {
  id: string
  role: 'ai' | 'user'
  content: string
  chips?: Chip[]
}

interface Chip {
  id: string
  label: string
  desc: string
}

interface Brief {
  topic: string
  goalLabel: string
  visualHint: string
  contentType: string
  objective: string
  productUrl: string
  slideCount: number
}

const GOAL_CHIPS: Chip[] = [
  { id: 'save',     label: '저장 많이 되는 콘텐츠', desc: 'Dark Editorial' },
  { id: 'purchase', label: '구매 전환 중심',        desc: 'Trend Feed' },
  { id: 'follow',   label: '팔로워 유입형',         desc: 'Breaking News' },
  { id: 'info',     label: '정보 교육 카드',        desc: 'Minimal Clean' },
]

const GOAL_MAP: Record<string, { visualHint: string; contentType: string; objective: string }> = {
  save:     { visualHint: 'dark-editorial',  contentType: '저장형 카드뉴스', objective: '저장 및 팔로우 유도' },
  purchase: { visualHint: 'trend-feed',      contentType: '구매 전환형',     objective: '구매 전환' },
  follow:   { visualHint: 'breaking-news',   contentType: '계정 유입형',     objective: '팔로워 유입' },
  info:     { visualHint: 'minimal-clean',   contentType: '교육 정보형',     objective: '정보 가치 전달' },
}

const SLIDE_CHIPS: Chip[] = [
  { id: '5',  label: '5장', desc: '간결하게' },
  { id: '7',  label: '7장', desc: '기본 구성' },
  { id: '10', label: '10장', desc: '상세하게' },
]

const LOADING_STEPS = [
  'AI가 브랜드를 분석하고 카드뉴스 콘셉트를 도출하고 있습니다.',
  '슬라이드별 최적의 마케팅 카피라인을 기획하고 있습니다.',
  '이미지 모델용 비주얼 방향과 배경 프롬프트를 설계하고 있습니다.',
  '헤드라인을 분절하고 타이포그래피 레이아웃을 계산하고 있습니다.',
  '가독성, safe area, 모바일 저장성을 최종 검수하고 있습니다.',
]

const EMPTY_BRIEF: Brief = {
  topic: '',
  goalLabel: '',
  visualHint: '',
  contentType: '',
  objective: '',
  productUrl: '',
  slideCount: 7,
}

let msgCounter = 0
function mkId() { return `m-${++msgCounter}` }

function aiMsg(content: string, chips?: Chip[]): Message {
  return { id: mkId(), role: 'ai', content, chips }
}

function userMsg(content: string): Message {
  return { id: mkId(), role: 'user', content }
}

export default function GenerateForm({ brand }: GenerateFormProps) {
  const router = useRouter()

  const [stage, setStage] = useState<Stage>('topic')
  const [messages, setMessages] = useState<Message[]>([
    aiMsg('안녕하세요! 오늘 어떤 상품을 소개할까요?'),
  ])
  const [brief, setBrief] = useState<Brief>(EMPTY_BRIEF)
  const [inputValue, setInputValue] = useState('')
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (stage === 'generating') {
      loadingIntervalRef.current = setInterval(() => {
        setLoadingStep(prev => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev))
      }, 4000)
    } else {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current)
      if (stage !== 'done') setLoadingStep(0)
    }
    return () => { if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current) }
  }, [stage])

  const push = (msg: Message) => setMessages(prev => [...prev, msg])

  const handleTopicSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const topic = inputValue.trim()
    if (!topic) return
    push(userMsg(topic))
    setBrief(prev => ({ ...prev, topic }))
    setInputValue('')
    setTimeout(() => {
      push(aiMsg(`좋아요, "${topic}"이군요. 어떤 목표로 만들까요?`, GOAL_CHIPS))
      setStage('goal')
    }, 400)
  }

  const handleGoalChip = (chip: Chip) => {
    push(userMsg(chip.label))
    const mapped = GOAL_MAP[chip.id]
    setBrief(prev => ({ ...prev, goalLabel: chip.label, ...mapped }))
    setTimeout(() => {
      push(aiMsg('스타일 확인했어요. 상품 페이지 URL이 있으면 보내주세요. 없으면 건너뛰어도 됩니다.'))
      setStage('url')
      inputRef.current?.focus()
    }, 400)
  }

  const handleUrlSubmit = (url?: string) => {
    const val = url ?? inputValue.trim()
    push(userMsg(val || 'URL 없이 진행할게요'))
    setBrief(prev => ({ ...prev, productUrl: val }))
    setInputValue('')
    setTimeout(() => {
      push(aiMsg('몇 장으로 구성할까요?', SLIDE_CHIPS))
      setStage('slides')
    }, 400)
  }

  const handleSlideChip = (chip: Chip) => {
    const count = parseInt(chip.id, 10)
    push(userMsg(chip.label))
    const updatedBrief = { ...brief, slideCount: count }
    setBrief(updatedBrief)
    setTimeout(() => {
      push(aiMsg(
        `"${updatedBrief.topic}" · ${updatedBrief.goalLabel} · ${count}장 구성으로 카드뉴스를 만들게요. 바로 시작할까요?`
      ))
      setStage('confirm')
    }, 400)
  }

  const handleGenerate = async () => {
    setStage('generating')
    setError(null)

    try {
      const res = await fetch('/api/campaigns/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignType: 'media',
          brandId: brand.id,
          topic: brief.topic,
          category: brand.industry,
          title: `${brief.topic} 카드뉴스`,
          keyContent: `${brief.topic} — ${brief.objective}`,
          tone: brand.toneOfVoice || '감성적이고 따뜻하게',
          contentType: brief.contentType,
          slideCount: brief.slideCount,
          productUrl: brief.productUrl || undefined,
          visualHint: brief.visualHint,
          objective: brief.objective,
        }),
      })

      const data = await res.json() as { campaignId?: string; error?: string }
      if (!res.ok || data.error) {
        setError(data.error || '생성에 실패했습니다.')
        setStage('confirm')
        return
      }

      router.push(`/campaign/${data.campaignId}`)
    } catch {
      setError('서버 통신 중 오류가 발생했습니다.')
      setStage('confirm')
    }
  }

  // ── Generating overlay ──────────────────────────────────────────
  if (stage === 'generating') {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm text-center"
        >
          <div className="mb-6 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0066ff]/10">
              <Sparkles className="h-6 w-6 animate-pulse text-[#0066ff]" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-[#111111]">카드뉴스 생성 중</h2>
          <p className="mt-2 text-sm text-[#71717a]">{LOADING_STEPS[loadingStep]}</p>
          <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-[#e4e4e7]">
            <motion.div
              className="h-full bg-[#0066ff]"
              animate={{ width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%` }}
              transition={{ duration: 3.5, ease: 'easeOut' }}
            />
          </div>
          <p className="mt-3 text-xs text-[#a1a1aa]">보통 1~2분 소요됩니다</p>
        </motion.div>
      </div>
    )
  }

  // ── Main layout ─────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">
      {/* Chat panel */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Brand chip */}
        <div className="shrink-0 border-b border-[#e4e4e7] px-5 py-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e4e4e7] bg-[#fafafa] px-3 py-1.5 text-xs font-medium text-[#52525b]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: brand.mainColor || '#0066ff' }} />
            {brand.name}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex max-w-[80%] flex-col gap-2.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.role === 'ai' && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#111111] text-[10px] font-bold text-white">
                      S
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                      msg.role === 'user'
                        ? 'rounded-tr-sm bg-[#111111] text-white'
                        : 'rounded-tl-sm bg-[#f4f4f5] text-[#111111]'
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Option chips */}
                  {msg.chips && stage !== 'confirm' && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {msg.chips.map((chip, i) => (
                        <motion.button
                          key={chip.id}
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.07, duration: 0.18 }}
                          type="button"
                          onClick={() => {
                            if (stage === 'goal') handleGoalChip(chip)
                            else if (stage === 'slides') handleSlideChip(chip)
                          }}
                          className="flex items-center gap-1.5 rounded-full border border-[#e4e4e7] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#111111] transition hover:border-[#111111] hover:bg-[#f4f4f5]"
                        >
                          {chip.label}
                          {chip.desc && <span className="text-[10px] text-[#a1a1aa]">{chip.desc}</span>}
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Confirm CTA */}
          {stage === 'confirm' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.1 }}
              className="flex justify-start"
            >
              <div className="flex flex-col gap-3">
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                    {error}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="flex items-center gap-2 rounded-full bg-[#0066ff] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#0052cc]"
                >
                  <Sparkles className="h-4 w-4" />
                  카드뉴스 생성 시작
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        {(stage === 'topic' || stage === 'url') && (
          <div className="shrink-0 border-t border-[#e4e4e7] bg-white px-4 py-3">
            <form
              onSubmit={stage === 'topic' ? handleTopicSubmit : (e) => { e.preventDefault(); handleUrlSubmit() }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type={stage === 'url' ? 'url' : 'text'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  stage === 'topic'
                    ? '예: 여름 반팔 티셔츠, 천연 스킨케어...'
                    : 'https://smartstore.naver.com/...'
                }
                className="h-11 flex-1 rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-4 text-sm text-[#111111] placeholder-[#a1a1aa] outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/10"
                autoFocus
              />
              {stage === 'url' && (
                <button
                  type="button"
                  onClick={() => handleUrlSubmit('')}
                  className="flex h-11 items-center gap-1.5 rounded-xl border border-[#e4e4e7] px-3.5 text-xs font-semibold text-[#71717a] transition hover:border-[#a1a1aa] hover:text-[#111111]"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  건너뛰기
                </button>
              )}
              <button
                type="submit"
                disabled={!inputValue.trim() && stage !== 'url'}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#111111] text-white transition hover:bg-[#333333] disabled:opacity-30"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Strategy Brief panel (hidden on mobile) */}
      <div className="hidden w-[340px] shrink-0 flex-col border-l border-[#e4e4e7] bg-[#fafafa] xl:flex">
        <div className="border-b border-[#e4e4e7] px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1aa]">Strategy Brief</p>
        </div>
        <div className="flex-1 px-5 py-6 space-y-5">
          <BriefRow label="브랜드" value={brand.name} always />
          <BriefRow label="상품" value={brief.topic} />
          <BriefRow label="목표" value={brief.objective} />
          <BriefRow label="스타일" value={brief.goalLabel} />
          <BriefRow label="비주얼" value={brief.visualHint} />
          <BriefRow label="URL" value={brief.productUrl ? new URL(brief.productUrl.startsWith('http') ? brief.productUrl : `https://${brief.productUrl}`).hostname : ''} />
          <BriefRow label="슬라이드" value={brief.slideCount > 0 && brief.topic ? `${brief.slideCount}장` : ''} />
        </div>
        <div className="border-t border-[#e4e4e7] px-5 py-4">
          <p className="text-[11px] leading-5 text-[#a1a1aa]">
            브랜드 DNA와 대화 내용을 바탕으로 카드뉴스 전략을 수립합니다.
          </p>
        </div>
      </div>
    </div>
  )
}

function BriefRow({ label, value, always }: { label: string; value: string; always?: boolean }) {
  const show = always || Boolean(value)
  return (
    <motion.div
      animate={{ opacity: show ? 1 : 0.3 }}
      transition={{ duration: 0.3 }}
      className="flex items-start justify-between gap-3"
    >
      <span className="shrink-0 text-[11px] font-semibold text-[#a1a1aa]">{label}</span>
      <span className="text-right text-xs font-semibold text-[#111111] truncate max-w-[200px]">
        {value || '—'}
      </span>
    </motion.div>
  )
}
