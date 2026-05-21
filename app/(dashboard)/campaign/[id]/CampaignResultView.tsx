'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  Type,
} from 'lucide-react'
import {
  approveAndScheduleCampaignAction,
  rerenderMediaSlideAction,
  updatePostDetailsAction,
  regenerateCampaignImagesAction,
} from '../../../actions'

interface Slide {
  id: string
  slideNumber: number
  headline: string
  body: string
  designPrompt: string
  imageUrl: string | null
}

interface Campaign {
  id: string
  title: string
  productName: string
  productDescription: string
  keyBenefits: string
  objective: string
  slideCount: number
  status: string
  slides: Slide[]
}

interface Post {
  id: string
  caption: string
  hashtags: string
  scheduledAt: string
}

interface Brand {
  name: string
  mainColor: string
  ctaStyle: string
}

interface CampaignResultViewProps {
  campaign: Campaign
  post: Post
  brand: Brand
  userPlan: string
  hasWatermark: boolean
  canSchedule: boolean
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function formatDateTime(dateStr: string) {
  const date = new Date(dateStr)
  const pad = (value: number) => value.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function inferLayoutLabel(prompt: string) {
  const normalized = prompt.toLowerCase()
  if (normalized.includes('data journalism')) return 'stat-highlight'
  if (normalized.includes('clean studio')) return 'minimal-clean'
  if (normalized.includes('cinematic portrait')) return 'cinematic-headline'
  if (normalized.includes('documentary news')) return 'breaking-news'
  if (normalized.includes('social feed')) return 'trend-feed'
  if (normalized.includes('magazine cover')) return 'magazine'
  if (normalized.includes('shallow depth')) return 'quote-focus'
  return 'dark-editorial'
}

function inferRole(slideNumber: number, total: number, prompt: string) {
  if (slideNumber === 1) return 'hook'
  if (slideNumber === total) return 'save-cta'
  if (slideNumber === 2) return 'context'
  if (prompt.toLowerCase().includes('data journalism')) return 'stat'
  return slideNumber % 2 === 0 ? 'detail' : 'key-point'
}

export default function CampaignResultView({
  campaign,
  post,
  brand,
  userPlan,
  hasWatermark,
  canSchedule,
}: CampaignResultViewProps) {
  const router = useRouter()
  const [slides, setSlides] = useState<Slide[]>([...campaign.slides].sort((a, b) => a.slideNumber - b.slideNumber))
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [headline, setHeadline] = useState(slides[0]?.headline || '')
  const [body, setBody] = useState(slides[0]?.body || '')
  const [caption, setCaption] = useState(post.caption)
  const [hashtags, setHashtags] = useState(post.hashtags)
  const [scheduledAt, setScheduledAt] = useState(formatDateTime(post.scheduledAt))
  const [rerendering, setRerendering] = useState(false)
  const [approving, setApproving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  const [selectedStyle, setSelectedStyle] = useState('photo')
  const [regeneratingStyle, setRegeneratingStyle] = useState(false)

  const activeSlide = slides[activeSlideIndex]

  const handleRegenerateStyle = async () => {
    setRegeneratingStyle(true)
    setMessage(null)

    try {
      const result = await regenerateCampaignImagesAction(campaign.id, selectedStyle)
      if (!result.success) {
        setMessage({ type: 'error', text: result.error || '스타일 변경에 실패했습니다.' })
        return
      }

      const updated = result.slides.map((s: {
        id: string
        slideNumber: number
        headline: string
        body: string
        designPrompt: string
        imageUrl: string | null
      }) => ({
        id: s.id,
        slideNumber: s.slideNumber,
        headline: s.headline,
        body: s.body,
        designPrompt: s.designPrompt,
        imageUrl: s.imageUrl,
      }))
      setSlides(updated)
      setMessage({ type: 'success', text: '모든 슬라이드의 AI 카드뉴스 스타일을 성공적으로 일괄 갱신했습니다!' })
      
      const activeIdx = activeSlideIndex
      if (updated[activeIdx]) {
        setHeadline(updated[activeIdx].headline)
        setBody(updated[activeIdx].body)
      }
    } catch (err) {
      setMessage({ type: 'error', text: getErrorMessage(err, '스타일 변경 처리 도중 오류가 발생했습니다.') })
    } finally {
      setRegeneratingStyle(false)
    }
  }
  const layoutLabel = activeSlide ? inferLayoutLabel(activeSlide.designPrompt) : '-'
  const roleLabel = activeSlide ? inferRole(activeSlide.slideNumber, slides.length, activeSlide.designPrompt) : '-'

  const selectSlide = (index: number) => {
    setActiveSlideIndex(index)
    setHeadline(slides[index]?.headline || '')
    setBody(slides[index]?.body || '')
    setMessage(null)
  }

  const rerenderSlide = async () => {
    if (!activeSlide) return
    setRerendering(true)
    setMessage(null)

    try {
      const result = await rerenderMediaSlideAction(activeSlide.id, headline, body)
      if (!result.success) {
        setMessage({ type: 'error', text: result.error || '슬라이드 재렌더링에 실패했습니다.' })
        return
      }

      const updatedSlides = slides.map((slide) =>
        slide.id === activeSlide.id
          ? {
              ...slide,
              headline,
              body,
              imageUrl: result.slide.imageUrl,
            }
          : slide
      )
      setSlides(updatedSlides)
      setMessage({ type: 'success', text: `${activeSlide.slideNumber}장 텍스트와 이미지를 다시 합성했습니다.` })
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, '슬라이드 재렌더링 중 오류가 발생했습니다.') })
    } finally {
      setRerendering(false)
    }
  }

  const approve = async () => {
    setApproving(true)
    setMessage(null)

    try {
      await updatePostDetailsAction(post.id, caption, hashtags)
      const result = await approveAndScheduleCampaignAction(campaign.id, post.id, {
        caption,
        hashtags,
        scheduledAt: new Date(scheduledAt).toISOString(),
      })

      if (!result.success) {
        setMessage({ type: 'error', text: result.error || '승인 처리에 실패했습니다.' })
        setApproving(false)
        return
      }

      setMessage({ type: 'success', text: result.message || '예약 대기열에 등록했습니다.' })
      setTimeout(() => router.push('/calendar'), 1200)
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, '승인 처리 중 오류가 발생했습니다.') })
      setApproving(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-8 md:px-8">
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Media Card Review</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black leading-[1.02] tracking-[-0.06em] text-[#1f1512] md:text-5xl">
            {campaign.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#746a62]">
            생성된 카드뉴스를 실제 렌더링 결과 기준으로 검토하고, 텍스트를 수정한 뒤 다시 합성할 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/campaign/new')}
          className="btn-secondary px-5"
        >
          <RefreshCw className="h-4 w-4" />
          새 캠페인
        </button>
      </div>

      {message && (
        <div className={`mb-6 rounded-[8px] border px-4 py-3 text-sm font-bold ${
          message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_440px]">
        <section className="space-y-5">
          <div className="rounded-[10px] border border-[#e8dfd4] bg-[#f8f3e9] p-4 shadow-[0_24px_70px_rgba(31,21,18,0.07)]">
            <div className="mx-auto max-w-[560px]">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[8px] bg-[#1f1512] shadow-[0_22px_70px_rgba(31,21,18,0.22)]">
                {activeSlide?.imageUrl?.endsWith('.png') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={activeSlide.imageUrl}
                    src={activeSlide.imageUrl}
                    alt={`${activeSlide.slideNumber}번 카드뉴스`}
                    className="h-full w-full object-cover"
                  />
                ) : activeSlide?.imageUrl ? (
                  <iframe
                    key={activeSlide.imageUrl}
                    src={activeSlide.imageUrl}
                    title={`${activeSlide.slideNumber}번 카드뉴스`}
                    className="h-full w-full border-0 bg-white"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-bold text-white/70">
                    렌더링 이미지가 없습니다.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => selectSlide(Math.max(0, activeSlideIndex - 1))}
                disabled={activeSlideIndex === 0}
                className="btn-secondary min-h-10 px-4 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="text-sm font-black text-[#1f1512]">
                {activeSlideIndex + 1} / {slides.length}
              </div>
              <button
                type="button"
                onClick={() => selectSlide(Math.min(slides.length - 1, activeSlideIndex + 1))}
                disabled={activeSlideIndex === slides.length - 1}
                className="btn-secondary min-h-10 px-4 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-5">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => selectSlide(index)}
                className={`overflow-hidden rounded-[8px] border bg-white p-1 transition ${
                  activeSlideIndex === index ? 'border-[#ff4f0a] shadow-[0_14px_28px_rgba(255,79,10,0.16)]' : 'border-[#e8dfd4] hover:border-[#ffb08a]'
                }`}
              >
                <div className="aspect-[4/5] overflow-hidden rounded-[5px] bg-[#f8f3e9]">
                  {slide.imageUrl?.endsWith('.png') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={slide.imageUrl} alt={`${slide.slideNumber} 썸네일`} className="h-full w-full object-cover" />
                  ) : slide.imageUrl ? (
                    <iframe src={slide.imageUrl} title={`${slide.slideNumber} 썸네일`} className="h-full w-full scale-[1.03] border-0 bg-white" />
                  ) : null}
                </div>
                <p className="mt-2 truncate px-1 pb-1 text-left text-[11px] font-black text-[#4a4039]">
                  {slide.slideNumber}. {slide.headline}
                </p>
              </button>
            ))}
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-[10px] border border-[#e8dfd4] bg-white p-5 shadow-[0_24px_70px_rgba(31,21,18,0.07)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="eyebrow">Media Tone</p>
                <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[#1f1512]">미디어 톤 재생성</h2>
              </div>
              <Sparkles className="h-5 w-5 text-[#ff4f0a]" />
            </div>

            <p className="mb-4 text-xs text-[#746a62] leading-relaxed">
              레퍼런스처럼 사진을 크게 쓰고 어두운 오버레이 위에 강한 제목을 올리는 방향으로 다시 생성합니다. 기존 텍스트는 보존됩니다.
            </p>

            <div className="mb-4 grid grid-cols-2 gap-2">
              {[
                { key: 'photo', label: '보도사진' },
                { key: 'minimalist', label: '다크 에디토리얼' },
                { key: 'gradients', label: '테크 뉴스' },
                { key: 'cyberpunk', label: '이슈 브리핑' },
                { key: 'vector', label: '매거진 포토' },
              ].map((style) => (
                <button
                  key={style.key}
                  type="button"
                  onClick={() => setSelectedStyle(style.key)}
                  className={`rounded-[6px] border py-2 text-xs font-bold transition ${
                    selectedStyle === style.key
                      ? 'border-[#ff4f0a] bg-[#ff4f0a]/5 text-[#ff4f0a]'
                      : 'border-[#e8dfd4] bg-white text-[#746a62] hover:border-[#ffb08a]'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleRegenerateStyle}
              disabled={regeneratingStyle}
              className="btn-primary w-full rounded-[8px] bg-[#ff4f0a] text-white flex items-center justify-center gap-2"
            >
              {regeneratingStyle ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>AI 스타일 변환 중...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  <span>미디어 스타일로 재생성</span>
                </>
              )}
            </button>
          </div>

          <div className="rounded-[10px] border border-[#e8dfd4] bg-white p-5 shadow-[0_24px_70px_rgba(31,21,18,0.07)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="eyebrow">Slide {activeSlide?.slideNumber}</p>
                <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[#1f1512]">타이포그래피 편집</h2>
              </div>
              <Type className="h-5 w-5 text-[#ff4f0a]" />
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3">
              <Meta label="role" value={roleLabel} />
              <Meta label="layout" value={layoutLabel} />
              <Meta label="brand" value={brand.name} />
              <Meta label="plan" value={userPlan} />
              <Meta label="watermark" value={hasWatermark ? 'on' : 'off'} />
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="headline" className="mb-2 block text-xs font-black text-[#4a4039]">
                  헤드라인
                </label>
                <input
                  id="headline"
                  value={headline}
                  onChange={(event) => setHeadline(event.target.value)}
                  className="field h-12 px-4 text-base font-bold"
                />
              </div>
              <div>
                <label htmlFor="body" className="mb-2 block text-xs font-black text-[#4a4039]">
                  본문
                </label>
                <textarea
                  id="body"
                  rows={4}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  className="field resize-none px-4 py-3 text-base leading-7"
                />
              </div>
              <button
                type="button"
                onClick={rerenderSlide}
                disabled={rerendering}
                className="btn-primary w-full rounded-[8px]"
              >
                {rerendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                텍스트 저장 및 재렌더링
              </button>
            </div>
          </div>

          <div className="rounded-[10px] border border-[#e8dfd4] bg-white p-5 shadow-[0_24px_70px_rgba(31,21,18,0.07)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="eyebrow">Instagram Post</p>
                <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[#1f1512]">캡션과 예약</h2>
              </div>
              <Calendar className="h-5 w-5 text-[#ff4f0a]" />
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="caption" className="mb-2 block text-xs font-black text-[#4a4039]">
                  캡션
                </label>
                <textarea
                  id="caption"
                  rows={6}
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  className="field resize-none px-4 py-3 text-sm leading-6"
                />
              </div>
              <div>
                <label htmlFor="hashtags" className="mb-2 block text-xs font-black text-[#4a4039]">
                  해시태그
                </label>
                <input
                  id="hashtags"
                  value={hashtags}
                  onChange={(event) => setHashtags(event.target.value)}
                  className="field h-12 px-4 text-sm font-bold"
                />
              </div>
              <div>
                <label htmlFor="scheduledAt" className="mb-2 block text-xs font-black text-[#4a4039]">
                  예약 일시
                </label>
                <input
                  id="scheduledAt"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                  className="field h-12 px-4 text-sm font-bold"
                />
              </div>

              {!canSchedule && (
                <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                  <div className="flex gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>현재 플랜은 자동 예약 발행이 제한됩니다. 검토용 저장은 가능합니다.</p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={approve}
                disabled={approving}
                className="btn-primary w-full rounded-[8px]"
              >
                {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                승인하고 예약하기
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="rounded-[10px] border border-[#d8edf7] bg-[#f3fbff] p-5 text-sm leading-6 text-[#4c6070]">
            <div className="mb-3 flex items-center gap-2 font-black text-[#1f1512]">
              <Clock className="h-4 w-4 text-[#2aa2db]" />
              렌더링 메모
            </div>
            <p className="mb-3">
              이 화면의 이미지는 이미지 모델이 만든 완성 카드가 아니라, 배경 이미지 위에 renderer가 한글 타이포그래피를 합성한 결과입니다.
            </p>
            {activeSlide?.imageUrl && (
              <div className="flex flex-wrap gap-2">
                <a href={activeSlide.imageUrl} target="_blank" rel="noreferrer" className="btn-secondary min-h-10 px-4 text-xs">
                  <ExternalLink className="h-4 w-4" />
                  원본 열기
                </a>
                <a href={activeSlide.imageUrl} download className="btn-secondary min-h-10 px-4 text-xs">
                  <Download className="h-4 w-4" />
                  이미지 저장
                </a>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[#e8dfd4] bg-[#fff8f0] px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#9a8d82]">{label}</p>
      <p className="mt-1 truncate text-xs font-black text-[#1f1512]">{value}</p>
    </div>
  )
}
