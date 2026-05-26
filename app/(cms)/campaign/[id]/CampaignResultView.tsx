'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import JSZip from 'jszip'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import {
  saveEditorialDocumentAction,
  regenerateEditorialBackgroundAction,
  rewriteEditorialCopyAction,
  exportEditorialSlideAction,
  updatePostDetailsAction,
} from '../../../actions'
import type { AgentReport, AgentReportItem } from '../../../../src/lib/carousel/agents'
import { parseEditorialDocument } from '../../../../src/lib/editor/document'
import { EditorialCanvas } from './editor/EditorialCanvas'
import { EditorialInspector } from './editor/EditorialInspector'
import { useEditorialStore } from './editor/useEditorialStore'

interface Slide {
  id: string
  slideNumber: number
  headline: string
  body: string
  designPrompt: string
  imageUrl: string | null
  backgroundImageUrl: string | null
  fontPreset: string | null
  textColor: string | null
  headlineFontSize: number | null
  bodyFontSize: number | null
  editorDocument: string | null
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
  imageModel: string | null
  initialImageCount: number
  regenerationImageCount: number
  lastRegenerationImageModel: string | null
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
  planName: string
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
  planName,
}: CampaignResultViewProps) {
  const router = useRouter()
  const [slides, setSlides] = useState<Slide[]>([...campaign.slides].sort((a, b) => a.slideNumber - b.slideNumber))
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [caption, setCaption] = useState(post.caption)
  const [hashtags, setHashtags] = useState(post.hashtags)
  const [editorBusy, setEditorBusy] = useState(false)
  const bgFileInputRef = useRef<HTMLInputElement>(null)
  const [savingCaption, setSavingCaption] = useState(false)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [regenerationImageCount, setRegenerationImageCount] = useState(campaign.regenerationImageCount)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [sidebarTab, setSidebarTab] = useState<'edit' | 'agent'>('edit')
  const documents = useEditorialStore(state => state.documents)
  const dirtySlides = useEditorialStore(state => state.dirtySlides)
  const initializeEditor = useEditorialStore(state => state.initialize)
  const activateSlide = useEditorialStore(state => state.activate)
  const updateDocument = useEditorialStore(state => state.updateDocument)
  const markSaved = useEditorialStore(state => state.markSaved)

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
  const remainingRegenerationImages = Math.max(campaign.slideCount - regenerationImageCount, 0)
  const activeDocument = activeSlide ? documents[activeSlide.id] : undefined

  useEffect(() => {
    const initialDocuments = Object.fromEntries(campaign.slides.map(slide => [
      slide.id,
      parseEditorialDocument(slide.editorDocument, slide),
    ]))
    if (campaign.slides[0]) initializeEditor(initialDocuments, campaign.slides[0].id)
  }, [campaign.slides, initializeEditor])

  useEffect(() => {
    if (!activeSlide || !activeDocument || !dirtySlides[activeSlide.id] || editorBusy) return
    const timeout = window.setTimeout(async () => {
      const result = await saveEditorialDocumentAction(activeSlide.id, JSON.stringify(activeDocument), false)
      if (result.success) markSaved(activeSlide.id)
    }, 900)
    return () => window.clearTimeout(timeout)
  }, [activeDocument, activeSlide, dirtySlides, editorBusy, markSaved])

  const selectSlide = (index: number) => {
    setActiveSlideIndex(index)
    if (slides[index]) activateSlide(slides[index].id)
    setMessage(null)
  }

  const applyServerSlide = (slide: Slide, document?: typeof activeDocument) => {
    setSlides(current => current.map(item => item.id === slide.id ? { ...item, ...slide } : item))
    if (document) {
      updateDocument(slide.id, () => document)
      markSaved(slide.id)
    }
  }

  const saveEditor = async (renderOutput: boolean) => {
    if (!activeSlide || !activeDocument) return
    setEditorBusy(true)
    setMessage(null)
    try {
      const result = await saveEditorialDocumentAction(activeSlide.id, JSON.stringify(activeDocument), renderOutput)
      if (!result.success) return setMessage({ type: 'error', text: result.error })
      applyServerSlide(result.slide as Slide, result.document)
      setMessage({ type: 'success', text: renderOutput ? '편집본을 고해상도 PNG로 확정 렌더했습니다.' : '편집 내용을 저장했습니다.' })
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, '편집 저장 중 오류가 발생했습니다.') })
    } finally {
      setEditorBusy(false)
    }
  }

  const regenerateBackground = async (variation: 'same-style' | 'stronger-mood' | 'brighter-background') => {
    if (!activeSlide || !activeDocument) return
    setEditorBusy(true)
    setMessage(null)
    try {
      const result = await regenerateEditorialBackgroundAction(activeSlide.id, JSON.stringify(activeDocument), variation)
      if (!result.success) return setMessage({ type: 'error', text: result.error })
      applyServerSlide(result.slide as Slide, result.document)
      setRegenerationImageCount(result.regenerationUsage.used)
      setMessage({ type: 'success', text: '레이아웃을 유지한 채 현재 슬라이드 배경만 변경했습니다.' })
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, '배경 생성 중 오류가 발생했습니다.') })
    } finally {
      setEditorBusy(false)
    }
  }

  const rewriteCopy = async (intent: string) => {
    if (!activeSlide || !activeDocument) return
    if (/밝|brighter/i.test(intent)) return regenerateBackground('brighter-background')
    if (/배경|이미지|무드|mood|background/i.test(intent)) return regenerateBackground('stronger-mood')
    setEditorBusy(true)
    try {
      const result = await rewriteEditorialCopyAction(activeSlide.id, JSON.stringify(activeDocument), intent)
      if (!result.success) return setMessage({ type: 'error', text: result.error })
      applyServerSlide(result.slide as Slide, result.document)
      setMessage({ type: 'success', text: '이미지는 유지하고 문구 레이어만 보정했습니다. 확정 렌더로 출력에 반영하세요.' })
    } finally {
      setEditorBusy(false)
    }
  }

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeSlide) return
    if (!activeDocument) return
    setEditorBusy(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append('files', file)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      const uploadData = await uploadRes.json() as { urls?: string[]; error?: string }
      const backgroundUrl = uploadData.urls?.[0]
      if (!uploadRes.ok || !backgroundUrl) {
        setMessage({ type: 'error', text: uploadData.error || '이미지 업로드에 실패했습니다.' })
        return
      }
      const nextDocument = {
        ...activeDocument,
        layers: activeDocument.layers.map(layer => layer.type === 'background' ? { ...layer, imageUrl: backgroundUrl } : layer),
      }
      updateDocument(activeSlide.id, () => nextDocument)
      const result = await saveEditorialDocumentAction(activeSlide.id, JSON.stringify(nextDocument), true)
      if (!result.success) {
        setMessage({ type: 'error', text: result.error || '배경 교체에 실패했습니다.' })
        return
      }
      applyServerSlide(result.slide as Slide, result.document)
      setMessage({ type: 'success', text: '업로드한 배경을 적용하고 확정 렌더했습니다.' })
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, '배경 교체 중 오류가 발생했습니다.') })
    } finally {
      setEditorBusy(false)
      if (bgFileInputRef.current) bgFileInputRef.current.value = ''
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

  const exportActive = async (format: 'png' | 'jpg', scale: 1 | 2) => {
    if (!activeSlide || !activeDocument) return
    setExporting(true)
    setMessage(null)
    try {
      const result = await exportEditorialSlideAction(activeSlide.id, JSON.stringify(activeDocument), format, scale)
      if (!result.success) return setMessage({ type: 'error', text: result.error })
      await downloadImage(result.url, fileNameFor(campaign.title, activeSlide.slideNumber, format))
      setMessage({ type: 'success', text: `${format.toUpperCase()} ${scale === 2 ? '2x 고해상도' : ''} 내보내기를 완료했습니다.` })
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, '내보내기에 실패했습니다.') })
    } finally {
      setExporting(false)
    }
  }

  const exportZip = async () => {
    setDownloadingAll(true)
    setMessage(null)
    try {
      const zip = new JSZip()
      for (const slide of slides) {
        const document = documents[slide.id] || parseEditorialDocument(slide.editorDocument, slide)
        const result = await exportEditorialSlideAction(slide.id, JSON.stringify(document), 'png', 1)
        if (!result.success) throw new Error(result.error)
        const response = await fetch(result.url)
        zip.file(fileNameFor(campaign.title, slide.slideNumber), await response.blob())
      }
      const archive = await zip.generateAsync({ type: 'blob' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(archive)
      link.download = `${campaign.title.replace(/\s+/g, '-')}-instagram-4x5.zip`
      link.click()
      URL.revokeObjectURL(link.href)
      setMessage({ type: 'success', text: 'Instagram 4:5 PNG 묶음을 ZIP으로 내보냈습니다.' })
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, 'ZIP 내보내기에 실패했습니다.') })
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
            AI가 만든 초안을 캔버스에서 직접 다듬고, 필요한 레이어만 AI로 보정한 뒤 제작용 이미지로 확정하세요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportZip} disabled={downloadingAll} className="btn-primary px-5">
            {downloadingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            전체 ZIP 내보내기
          </button>
          <button type="button" onClick={() => router.push('/generate')} className="btn-secondary px-5">
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
          <div className="rounded-[10px] border border-[#21242b] bg-[#111318] p-5 shadow-[0_24px_70px_rgba(31,21,18,0.18)]">
            {activeSlide && <EditorialCanvas slideId={activeSlide.id} />}

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
              {activeSlide && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Meta label="role" value={roleLabel} />
                    <Meta label="layout" value={layoutLabel} />
                    <Meta label="brand" value={brand.name} />
                    <Meta label="plan" value={planName} />
                  </div>
                  <EditorialInspector
                    slideId={activeSlide.id}
                    busy={editorBusy}
                    credits={remainingRegenerationImages}
                    onSave={saveEditor}
                    onBackgroundVariation={regenerateBackground}
                    onRewrite={rewriteCopy}
                    onUpload={() => bgFileInputRef.current?.click()}
                  />
                </>
              )}
              <input ref={bgFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBackgroundUpload} />

              <div className="rounded-[10px] border border-[#e8dfd4] bg-white p-5 shadow-[0_24px_70px_rgba(31,21,18,0.07)]">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="eyebrow">Caption</p>
                    <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[#1f1512]">콘텐츠 문안 메모</h2>
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
                            ? '✅ 품질 기준 통과 (사용 권장)'
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
              <button type="button" onClick={() => exportActive('png', 1)} disabled={exporting || !activeDocument} className="btn-secondary min-h-10 px-4 text-xs">
                PNG
              </button>
              <button type="button" onClick={() => exportActive('jpg', 1)} disabled={exporting || !activeDocument} className="btn-secondary min-h-10 px-4 text-xs">
                JPG
              </button>
              <button type="button" onClick={() => exportActive('png', 2)} disabled={exporting || !activeDocument} className="btn-secondary min-h-10 px-4 text-xs">
                PNG 2x
              </button>
              <button type="button" onClick={exportZip} disabled={downloadingAll} className="btn-primary min-h-10 px-4 text-xs">
                {downloadingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                전체 ZIP
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
