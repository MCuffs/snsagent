'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  Type,
} from 'lucide-react'
import {
  rerenderMediaSlideAction,
  updatePostDetailsAction,
  regenerateCampaignImagesAction,
} from '../../../actions'
import type { AgentReport, AgentReportItem } from '../../../../src/lib/carousel/agents'

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
  agentReport?: string | null
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
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function inferLayoutLabel(prompt: string) {
  const normalized = prompt.toLowerCase()
  if (normalized.includes('data journalism')) return 'stat-highlight'
  if (normalized.includes('clean studio')) return 'minimal-clean'
  if (normalized.includes('cinematic portrait')) return 'cinematic-headline'
  if (normalized.includes('documentary news')) return 'breaking-news'
  if (normalized.includes('social feed')) return 'trend-feed'
  if (normalized.includes('magazine cover')) return 'magazine'
  return 'dark-editorial'
}

function inferRole(slideNumber: number, total: number, prompt: string) {
  if (slideNumber === 1) return 'hook'
  if (slideNumber === total) return 'save-cta'
  if (slideNumber === 2) return 'context'
  if (prompt.toLowerCase().includes('data journalism')) return 'stat'
  return slideNumber % 2 === 0 ? 'detail' : 'key-point'
}

function fileNameFor(campaignTitle: string, slideNumber: number, extension = 'png') {
  const safeTitle = campaignTitle
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 48) || 'card-news'
  return `${safeTitle}-${String(slideNumber).padStart(2, '0')}.${extension}`
}

async function downloadImage(url: string, fileName: string) {
  if (url.startsWith('data:')) {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    return
  }

  const response = await fetch(url)
  if (!response.ok) throw new Error(`download failed: HTTP ${response.status}`)
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  link.click()
  URL.revokeObjectURL(objectUrl)
}

export default function CampaignResultView({
  campaign,
  post,
  brand,
  userPlan,
  hasWatermark,
}: CampaignResultViewProps) {
  const router = useRouter()
  const [slides, setSlides] = useState<Slide[]>([...campaign.slides].sort((a, b) => a.slideNumber - b.slideNumber))
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [headline, setHeadline] = useState(slides[0]?.headline || '')
  const [body, setBody] = useState(slides[0]?.body || '')
  const [caption, setCaption] = useState(post.caption)
  const [hashtags, setHashtags] = useState(post.hashtags)
  const [rerendering, setRerendering] = useState(false)
  const [savingCaption, setSavingCaption] = useState(false)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [selectedStyle, setSelectedStyle] = useState('photo')
  const [regeneratingStyle, setRegeneratingStyle] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [sidebarTab, setSidebarTab] = useState<'edit' | 'agent'>('edit')
  const [selectedFont, setSelectedFont] = useState<'sans' | 'serif'>('sans')
  const [textColor, setTextColor] = useState<string>('#ffffff')

  let agentReportData: AgentReport | null = null
  if (campaign.agentReport) {
    try {
      agentReportData = JSON.parse(campaign.agentReport) as AgentReport
    } catch (e) {
      console.error('Failed to parse agentReport JSON', e)
    }
  }

  const activeSlide = slides[activeSlideIndex]
  const layoutLabel = activeSlide ? inferLayoutLabel(activeSlide.designPrompt) : '-'
  const roleLabel = activeSlide ? inferRole(activeSlide.slideNumber, slides.length, activeSlide.designPrompt) : '-'

  const selectSlide = (index: number) => {
    setActiveSlideIndex(index)
    setHeadline(slides[index]?.headline || '')
    setBody(slides[index]?.body || '')
    setMessage(null)
  }

  const handleRegenerateStyle = async () => {
    setRegeneratingStyle(true)
    setMessage(null)

    try {
      const result = await regenerateCampaignImagesAction(campaign.id, selectedStyle)
      if (!result.success) {
        setMessage({ type: 'error', text: result.error || '스타일 재생성에 실패했습니다.' })
        return
      }

      const updated = result.slides
        .map((slide: Slide) => ({
          id: slide.id,
          slideNumber: slide.slideNumber,
          headline: slide.headline,
          body: slide.body,
          designPrompt: slide.designPrompt,
          imageUrl: slide.imageUrl,
        }))
        .sort((a: Slide, b: Slide) => a.slideNumber - b.slideNumber)

      setSlides(updated)
      if (updated[activeSlideIndex]) {
        setHeadline(updated[activeSlideIndex].headline)
        setBody(updated[activeSlideIndex].body)
      }
      setMessage({ type: 'success', text: '전체 카드 스타일을 다시 생성했습니다.' })
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, '스타일 재생성 중 오류가 발생했습니다.') })
    } finally {
      setRegeneratingStyle(false)
    }
  }

  const rerenderSlide = async () => {
    if (!activeSlide) return
    setRerendering(true)
    setMessage(null)

    try {
      const fontFamily = selectedFont === 'serif'
        ? 'Georgia, Times New Roman, Pretendard, serif'
        : 'Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif'
      const result = await rerenderMediaSlideAction(activeSlide.id, headline, body, {
        fontFamily,
        textColor,
      })
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
      setMessage({ type: 'success', text: `${activeSlide.slideNumber}번 카드를 다시 렌더링했습니다.` })
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, '슬라이드 재렌더링 중 오류가 발생했습니다.') })
    } finally {
      setRerendering(false)
    }
  }

  const saveCaption = async () => {
    setSavingCaption(true)
    setMessage(null)

    try {
      const result = await updatePostDetailsAction(post.id, caption, hashtags)
      if (!result.success) {
        setMessage({ type: 'error', text: result.error || '캡션 저장에 실패했습니다.' })
        return
      }
      setMessage({ type: 'success', text: '캡션과 해시태그를 저장했습니다.' })
      router.refresh()
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, '캡션 저장 중 오류가 발생했습니다.') })
    } finally {
      setSavingCaption(false)
    }
  }

  const downloadActiveSlide = async () => {
    if (!activeSlide?.imageUrl) return
    setMessage(null)
    try {
      await downloadImage(activeSlide.imageUrl, fileNameFor(campaign.title, activeSlide.slideNumber))
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, '이미지 다운로드에 실패했습니다.') })
    }
  }

  const downloadAllSlides = async () => {
    setDownloadingAll(true)
    setMessage(null)
    try {
      for (const slide of slides) {
        if (slide.imageUrl) {
          await downloadImage(slide.imageUrl, fileNameFor(campaign.title, slide.slideNumber))
          await new Promise(resolve => setTimeout(resolve, 140))
        }
      }
      setMessage({ type: 'success', text: '전체 카드 다운로드를 시작했습니다.' })
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, '전체 다운로드 중 오류가 발생했습니다.') })
    } finally {
      setDownloadingAll(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-8 md:px-8">
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Card News Studio</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black leading-[1.2] tracking-[-0.03em] text-[#1f1512] md:text-5xl">
            {campaign.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#746a62]">
            카드뉴스를 검토하고 문구를 편집한 뒤 PNG 파일로 다운로드하세요. 새 카드뉴스가 필요하면 바로 이어서 만들 수 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={downloadAllSlides} disabled={downloadingAll} className="btn-primary px-5">
            {downloadingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            전체 다운로드
          </button>
          <button type="button" onClick={() => router.push('/campaign/new')} className="btn-secondary px-5">
            <RefreshCw className="h-4 w-4" />
            새 카드뉴스 만들기
          </button>
        </div>
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
                {activeSlide?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={activeSlide.imageUrl}
                    src={activeSlide.imageUrl}
                    alt={`${activeSlide.slideNumber}번 카드뉴스`}
                    className="h-full w-full object-cover"
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
                  {slide.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={slide.imageUrl} alt={`${slide.slideNumber}번 썸네일`} className="h-full w-full object-cover" />
                  )}
                </div>
                <p className="mt-2 truncate px-1 pb-1 text-left text-[11px] font-black text-[#4a4039]">
                  {slide.slideNumber}. {slide.headline}
                </p>
              </button>
            ))}
          </div>
        </section>

        <aside className="space-y-5">
          {/* Sidebar Tabs */}
          <div className="flex border-b border-[#e8dfd4] mb-4">
            <button
              type="button"
              onClick={() => setSidebarTab('edit')}
              className={`flex-1 py-3 text-center text-xs font-black tracking-wider uppercase transition-colors ${
                sidebarTab === 'edit'
                  ? 'border-b-2 border-[#ff4f0a] text-[#ff4f0a]'
                  : 'text-[#746a62] hover:text-[#1f1512]'
              }`}
            >
              편집 에디터
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('agent')}
              className={`flex-1 py-3 text-center text-xs font-black tracking-wider uppercase transition-colors ${
                sidebarTab === 'agent'
                  ? 'border-b-2 border-[#ff4f0a] text-[#ff4f0a]'
                  : 'text-[#746a62] hover:text-[#1f1512]'
              }`}
            >
              AI 에이전트 리포트
            </button>
          </div>

          {sidebarTab === 'edit' && (
            <>
              <div className="rounded-[10px] border border-[#e8dfd4] bg-white p-5 shadow-[0_24px_70px_rgba(31,21,18,0.07)]">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="eyebrow">Style</p>
                    <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[#1f1512]">전체 스타일 재생성</h2>
                  </div>
                  <Sparkles className="h-5 w-5 text-[#ff4f0a]" />
                </div>

                <div className="mb-4 grid grid-cols-2 gap-2">
                  {[
                    { key: 'photo', label: '보도사진' },
                    { key: 'minimalist', label: '미니멀' },
                    { key: 'gradients', label: '다크 무드' },
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
                  className="btn-primary w-full rounded-[8px]"
                >
                  {regeneratingStyle ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  스타일 다시 만들기
                </button>
              </div>

              <div className="rounded-[10px] border border-[#e8dfd4] bg-white p-5 shadow-[0_24px_70px_rgba(31,21,18,0.07)]">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="eyebrow">Slide {activeSlide?.slideNumber}</p>
                    <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[#1f1512]">문구 편집</h2>
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
                  {/* Font selector */}
                  <div>
                    <label className="mb-2 block text-xs font-black text-[#4a4039]">폰트</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'sans' as const, label: 'Pretendard', hint: '기본 고딕체' },
                        { key: 'serif' as const, label: 'Georgia', hint: '세리프 서체' },
                      ].map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => setSelectedFont(f.key)}
                          className={`rounded-[6px] border py-2.5 text-left px-3 transition ${
                            selectedFont === f.key
                              ? 'border-[#ff4f0a] bg-[#ff4f0a]/5 text-[#ff4f0a]'
                              : 'border-[#e8dfd4] bg-white text-[#746a62] hover:border-[#ffb08a]'
                          }`}
                        >
                          <p className="text-xs font-black">{f.label}</p>
                          <p className="text-[10px] opacity-60">{f.hint}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Text color selector */}
                  <div>
                    <label className="mb-2 block text-xs font-black text-[#4a4039]">텍스트 색상</label>
                    <div className="flex items-center gap-2">
                      {[
                        { value: '#ffffff', label: '화이트' },
                        { value: '#111111', label: '다크' },
                        { value: brand.mainColor, label: '브랜드' },
                      ].map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          title={c.label}
                          onClick={() => setTextColor(c.value)}
                          className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition ${
                            textColor === c.value ? 'border-[#ff4f0a] scale-110' : 'border-[#e8dfd4] hover:border-[#ffb08a]'
                          }`}
                          style={{ backgroundColor: c.value }}
                        />
                      ))}
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        title="커스텀 색상"
                        className="h-9 w-9 cursor-pointer rounded-full border-2 border-[#e8dfd4] p-0.5 hover:border-[#ffb08a]"
                      />
                    </div>
                  </div>

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
                    이 카드 다시 렌더링
                  </button>
                </div>
              </div>

              <div className="rounded-[10px] border border-[#e8dfd4] bg-white p-5 shadow-[0_24px_70px_rgba(31,21,18,0.07)]">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="eyebrow">Caption</p>
                    <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[#1f1512]">게시글 문안 메모</h2>
                  </div>
                  <Check className="h-5 w-5 text-[#ff4f0a]" />
                </div>

                <div className="space-y-4">
                  <textarea
                    rows={6}
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    className="field resize-none px-4 py-3 text-sm leading-6"
                  />
                  <input
                    value={hashtags}
                    onChange={(event) => setHashtags(event.target.value)}
                    className="field h-12 px-4 text-sm font-bold"
                  />
                  <button type="button" onClick={saveCaption} disabled={savingCaption} className="btn-secondary w-full rounded-[8px]">
                    {savingCaption ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    문안 저장
                  </button>
                </div>
              </div>
            </>
          )}

          {sidebarTab === 'agent' && (
            <div className="space-y-5">
              {agentReportData ? (
                <>
                  <div className="rounded-[10px] border border-[#e8dfd4] bg-white p-5 shadow-[0_24px_70px_rgba(31,21,18,0.07)]">
                    <p className="eyebrow">Quality Score</p>
                    <div className="mt-4 flex items-center justify-between">
                      <div>
                        <div className="text-4xl font-black text-[#1f1512]">
                          {agentReportData.score}점
                        </div>
                        <p className="mt-1 text-[11px] font-bold text-[#746a62]">
                          {agentReportData.status === 'passed'
                            ? '✅ 품질 기준 통과 (발행 권장)'
                            : '⚠️ 일부 조정 권장 (needs_review)'}
                        </p>
                      </div>
                      <div className={`h-12 w-12 rounded-full border-4 flex items-center justify-center font-black text-sm ${
                        agentReportData.status === 'passed'
                          ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
                          : 'border-amber-500 text-amber-600 bg-amber-50'
                      }`}>
                        {agentReportData.score >= 90 ? 'A+' : agentReportData.score >= 80 ? 'A' : 'B'}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[10px] border border-[#e8dfd4] bg-white p-5 shadow-[0_24px_70px_rgba(31,21,18,0.07)]">
                    <h3 className="text-sm font-black text-[#1f1512] mb-5">AI 에이전트 상세 활약 로그</h3>
                    <div className="relative border-l-2 border-[#e8dfd4] pl-4 ml-2 space-y-6">
                      {agentReportData.logs?.map((log: AgentReportItem, idx: number) => {
                        let icon = 'ℹ️'
                        let color = 'text-[#746a62]'
                        let bg = 'bg-[#f8f3e9] border-[#e8dfd4]'
                        if (log.status === 'success') {
                          icon = '✅'
                          color = 'text-emerald-800'
                          bg = 'bg-emerald-50/50 border-emerald-100'
                        } else if (log.status === 'warn') {
                          icon = '⚠️'
                          color = 'text-amber-800'
                          bg = 'bg-amber-50/50 border-amber-100'
                        } else if (log.status === 'error') {
                          icon = '🚨'
                          color = 'text-rose-800'
                          bg = 'bg-rose-50/50 border-rose-100'
                        }

                        return (
                          <div key={idx} className="relative">
                            <span className="absolute -left-[25px] top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white border-2 border-[#ff4f0a] text-[8px] font-bold">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-wider text-[#ff4f0a]">{log.agentName}</span>
                                <span className="text-[10px] text-[#746a62] font-semibold">{log.role}</span>
                              </div>
                              <div className={`mt-2 rounded-[6px] border p-3 text-xs leading-5 font-bold ${color} ${bg}`}>
                                <span className="mr-1">{icon}</span> {log.message}
                                {log.details !== undefined && log.details !== null && (
                                  <pre className="mt-2 overflow-x-auto rounded bg-black/5 p-2 text-[10px] text-[#4a4039] font-mono leading-4">
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-[10px] border border-[#e8dfd4] bg-white p-5 text-center text-sm font-bold text-[#746a62]">
                  이 캠페인은 AI 에이전트 리포트 기능이 구현되기 전에 제작되었습니다.
                </div>
              )}
            </div>
          )}

          <div className="rounded-[10px] border border-[#d8edf7] bg-[#f3fbff] p-5 text-sm leading-6 text-[#4c6070]">
            <div className="mb-3 flex items-center gap-2 font-black text-[#1f1512]">
              <Download className="h-4 w-4 text-[#2aa2db]" />
              다운로드
            </div>
            <p className="mb-3">
              완성된 카드뉴스를 이미지 파일로 내려받을 수 있습니다. 추가 콘텐츠가 필요하면 새 카드뉴스를 바로 만들어 이어가세요.
            </p>
            <div className="flex flex-wrap gap-2">
              {activeSlide?.imageUrl && (
                <>
                  <a href={activeSlide.imageUrl} target="_blank" rel="noreferrer" className="btn-secondary min-h-10 px-4 text-xs">
                    <ExternalLink className="h-4 w-4" />
                    원본 열기
                  </a>
                  <button type="button" onClick={downloadActiveSlide} className="btn-secondary min-h-10 px-4 text-xs">
                    <Download className="h-4 w-4" />
                    현재 카드 다운로드
                  </button>
                </>
              )}
              <button type="button" onClick={downloadAllSlides} disabled={downloadingAll} className="btn-primary min-h-10 px-4 text-xs">
                {downloadingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                전체 다운로드
              </button>
            </div>
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
