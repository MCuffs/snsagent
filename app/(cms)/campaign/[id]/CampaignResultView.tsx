'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
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
  exportEditorialSlideAction,
  resetSlideEditorDocumentAction,
  updatePostDetailsAction,
} from '../../../actions'
import type { AgentReport, AgentReportItem } from '../../../../src/lib/carousel/agents'
import { applyBrandStyleMemory, parseEditorialDocument } from '../../../../src/lib/editor/document'
import type { EditorialLayer } from '../../../../src/lib/editor/types'
import { EditorialCanvas } from './editor/EditorialCanvas'
import { EditorialInspector } from './editor/EditorialInspector'
import { useEditorialStore } from './editor/useEditorialStore'
import { analytics } from '../../../../lib/analytics/thinkingdata'

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
  editorPreferences: string | null
}

interface CampaignResultViewProps {
  campaign: Campaign
  post: Post
  brand: Brand
  planName: string
  regenerationAccess: 'blocked' | 'single-use' | 'included'
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
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
}: CampaignResultViewProps) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('campaign')
  const [slides, setSlides] = useState<Slide[]>([...campaign.slides].sort((a, b) => a.slideNumber - b.slideNumber))
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [caption, setCaption] = useState(post.caption)
  const [hashtags, setHashtags] = useState(post.hashtags)
  const [editorBusy, setEditorBusy] = useState(false)
  const imgFileInputRef = useRef<HTMLInputElement>(null)
  const [savingCaption, setSavingCaption] = useState(false)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [sidebarTab, setSidebarTab] = useState<'edit' | 'agent'>('edit')
  const documents = useEditorialStore(state => state.documents)
  const dirtySlides = useEditorialStore(state => state.dirtySlides)
  const initializeEditor = useEditorialStore(state => state.initialize)
  const activateSlide = useEditorialStore(state => state.activate)
  const updateDocument = useEditorialStore(state => state.updateDocument)
  const addLayer = useEditorialStore(state => state.addLayer)
  const selectLayer = useEditorialStore(state => state.selectLayer)
  const markSaved = useEditorialStore(state => state.markSaved)

  useEffect(() => {
    analytics.campaignView(campaign.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  let agentReportData: AgentReport | null = null
  if (campaign.agentReport) {
    try {
      agentReportData = JSON.parse(campaign.agentReport) as AgentReport
    } catch (e) {
      console.error('Failed to parse agentReport JSON', e)
    }
  }

  const activeSlide = slides[activeSlideIndex]
  const activeDocument = activeSlide ? documents[activeSlide.id] : undefined

  const uploadAndAddImageLayer = useCallback(async (file: File) => {
    if (!activeSlide || !activeDocument) return
    setEditorBusy(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append('files', file)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      const uploadData = await uploadRes.json() as { urls?: string[]; error?: string }
      const imageUrl = uploadData.urls?.[0]
      if (!uploadRes.ok || !imageUrl) {
        setMessage({ type: 'error', text: uploadData.error || t('message_upload_error') })
        return
      }
      const newLayerId = `img-${Date.now()}`
      const newLayer: EditorialLayer = {
        id: newLayerId,
        type: 'sticker',
        name: file.name.replace(/\.[^.]+$/, '').slice(0, 40) || t('message_image_layer_name'),
        visible: true,
        locked: false,
        opacity: 100,
        zIndex: 80,
        x: 340,
        y: 475,
        width: 400,
        height: 400,
        scale: 1,
        rotation: 0,
        blur: 0,
        shadow: 0,
        imageUrl,
      }
      addLayer(activeSlide.id, newLayer)
      selectLayer(newLayerId)
      setMessage({ type: 'success', text: t('message_image_layer_added') })
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, t('message_image_layer_error')) })
    } finally {
      setEditorBusy(false)
    }
  }, [activeDocument, activeSlide, addLayer, selectLayer, t])

  useEffect(() => {
    const pasteHandler = async (e: ClipboardEvent) => {
      if (!activeSlide || !activeDocument) return
      // Only handle when not typing in a text field
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      const items = Array.from(e.clipboardData?.items ?? [])
      const imageItem = items.find(item => item.kind === 'file' && item.type.startsWith('image/'))
      if (!imageItem) return

      e.preventDefault()
      const file = imageItem.getAsFile()
      if (!file) return
      await uploadAndAddImageLayer(file)
    }

    const keyHandler = async (e: KeyboardEvent) => {
      if (!((e.ctrlKey || e.metaKey) && e.key === 'v')) return
      if (!activeSlide || !activeDocument) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      try {
        const items = await navigator.clipboard.read()
        for (const item of items) {
          const imageType = item.types.find(t => t.startsWith('image/'))
          if (imageType) {
            const blob = await item.getType(imageType)
            const file = new File([blob], `pasted-${Date.now()}.${imageType.split('/')[1] || 'png'}`, { type: imageType })
            await uploadAndAddImageLayer(file)
            break
          }
        }
      } catch { /* permission denied or no image */ }
    }

    window.addEventListener('paste', pasteHandler)
    window.addEventListener('keydown', keyHandler)
    return () => {
      window.removeEventListener('paste', pasteHandler)
      window.removeEventListener('keydown', keyHandler)
    }
  }, [activeSlide, activeDocument, uploadAndAddImageLayer])

  useEffect(() => {
    const initialDocuments = Object.fromEntries(campaign.slides.map(slide => [
      slide.id,
      slide.editorDocument
        ? parseEditorialDocument(slide.editorDocument, slide)
        : applyBrandStyleMemory(parseEditorialDocument(null, slide), brand.editorPreferences),
    ]))
    if (campaign.slides[0]) initializeEditor(initialDocuments, campaign.slides[0].id)
  }, [brand.editorPreferences, campaign.slides, initializeEditor])

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

  const handleBackgroundUpload = async (file: File, scale: number, offsetX: number, offsetY: number) => {
    if (!activeSlide || !activeDocument) return
    setEditorBusy(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append('files', file)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      const uploadData = await uploadRes.json() as { urls?: string[]; error?: string }
      const backgroundUrl = uploadData.urls?.[0]
      if (!uploadRes.ok || !backgroundUrl) {
        setMessage({ type: 'error', text: uploadData.error || t('message_upload_error') })
        return
      }
      const nextDocument = {
        ...activeDocument,
        layers: activeDocument.layers.map(layer =>
          layer.type === 'background'
            ? { ...layer, imageUrl: backgroundUrl, scale, x: Math.round(offsetX * (1080 - 1080 * scale)), y: Math.round(offsetY * (1350 - 1350 * scale)) }
            : layer
        ),
      }
      updateDocument(activeSlide.id, () => nextDocument)
      const result = await saveEditorialDocumentAction(activeSlide.id, JSON.stringify(nextDocument), true)
      if (!result.success) {
        setMessage({ type: 'error', text: result.error || t('message_background_error') })
        return
      }
      applyServerSlide(result.slide as Slide, result.document)
      setMessage({ type: 'success', text: t('message_background_saved') })
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, t('message_background_save_error')) })
    } finally {
      setEditorBusy(false)
    }
  }

  const handleResetBackground = async () => {
    if (!activeSlide || !activeDocument) return
    const originalUrl = slides.find(s => s.id === activeSlide.id)?.backgroundImageUrl || null
    setEditorBusy(true)
    setMessage(null)
    try {
      const nextDocument = {
        ...activeDocument,
        layers: activeDocument.layers.map(layer =>
          layer.type === 'background' ? { ...layer, imageUrl: originalUrl } : layer
        ),
      }
      updateDocument(activeSlide.id, () => nextDocument)
      const result = await saveEditorialDocumentAction(activeSlide.id, JSON.stringify(nextDocument), true)
      if (!result.success) {
        setMessage({ type: 'error', text: result.error || t('message_background_error') })
        return
      }
      applyServerSlide(result.slide as Slide, result.document)
      setMessage({ type: 'success', text: '원래 배경으로 복원했습니다.' })
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, t('message_background_save_error')) })
    } finally {
      setEditorBusy(false)
    }
  }

  const handleImageStickerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadAndAddImageLayer(file)
    if (imgFileInputRef.current) imgFileInputRef.current.value = ''
  }

  const saveCaption = async () => {
    setSavingCaption(true)
    setMessage(null)

    try {
      const result = await updatePostDetailsAction(post.id, caption, hashtags)
      if (!result.success) {
        setMessage({ type: 'error', text: result.error || t('message_caption_error') })
        return
      }
      setMessage({ type: 'success', text: t('message_caption_saved') })
      router.refresh()
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, t('message_caption_save_error')) })
    } finally {
      setSavingCaption(false)
    }
  }

  const downloadActiveSlide = async () => {
    if (!activeSlide?.imageUrl) return
    setExporting(true)
    setMessage(null)
    analytics.campaignDownload(campaign.id, 'png', 1)
    try {
      if (activeDocument) {
        const result = await exportEditorialSlideAction(activeSlide.id, JSON.stringify(activeDocument), 'png', 1)
        if (!result.success) return setMessage({ type: 'error', text: result.error })
        await downloadImage(result.url, fileNameFor(campaign.title, activeSlide.slideNumber))
      } else {
        await downloadImage(activeSlide.imageUrl, fileNameFor(campaign.title, activeSlide.slideNumber))
      }
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, t('message_download_error')) })
    } finally {
      setExporting(false)
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
      setMessage({ type: 'success', text: scale === 2 ? t('message_export_done_2x', { format: format.toUpperCase() }) : t('message_export_done', { format: format.toUpperCase() }) })
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, t('message_export_error')) })
    } finally {
      setExporting(false)
    }
  }

  const exportZip = async () => {
    setDownloadingAll(true)
    setMessage(null)
    analytics.campaignDownload(campaign.id, 'zip', slides.length)
    try {
      const zip = new JSZip()
      const results = await Promise.all(
        slides.map(async slide => {
          const doc = documents[slide.id] || parseEditorialDocument(slide.editorDocument, slide)
          const result = await exportEditorialSlideAction(slide.id, JSON.stringify(doc), 'png', 1)
          if (!result.success) throw new Error(result.error)
          const response = await fetch(result.url)
          return { name: fileNameFor(campaign.title, slide.slideNumber), blob: await response.blob() }
        })
      )
      for (const { name, blob } of results) zip.file(name, blob)
      const archive = await zip.generateAsync({ type: 'blob' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(archive)
      link.download = `${campaign.title.replace(/\s+/g, '-')}-instagram-4x5.zip`
      link.click()
      URL.revokeObjectURL(link.href)
      setMessage({ type: 'success', text: t('message_zip_done') })
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, t('message_zip_error')) })
    } finally {
      setDownloadingAll(false)
    }
  }

  const resetEditor = async () => {
    if (!activeSlide) return
    setEditorBusy(true)
    setMessage(null)
    try {
      const result = await resetSlideEditorDocumentAction(activeSlide.id)
      if (!result.success) return setMessage({ type: 'error', text: result.error })
      applyServerSlide(result.slide as Slide, parseEditorialDocument(null, result.slide as Slide))
      setMessage({ type: 'success', text: t('message_reset_done') })
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, t('message_reset_error')) })
    } finally {
      setEditorBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-8 md:px-8">
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">{t('page_eyebrow')}</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black leading-[1.2] tracking-[-0.03em] text-[#1f1512] md:text-5xl">
            {campaign.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#746a62]">
            {t('page_desc')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportZip} disabled={downloadingAll} className="btn-primary px-5">
            {downloadingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t('export_zip_full')}
          </button>
          <button type="button" onClick={() => router.push(`/${locale}/generate`)} className="btn-secondary px-5">
            <RefreshCw className="h-4 w-4" />
            {t('new_card')}
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
            {activeSlide && <EditorialCanvas slideId={activeSlide.id} fallbackImageUrl={activeSlide.imageUrl} />}

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
                    <img src={slide.imageUrl} alt={t('thumbnail_alt', { number: slide.slideNumber })} className="h-full w-full object-cover" />
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
              {t('editor_tab')}
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
              {t('agent_tab')}
            </button>
          </div>

          {sidebarTab === 'edit' && (
            <>
              {activeSlide && (
                <>
                  <EditorialInspector
                    slideId={activeSlide.id}
                    slideNumber={activeSlide.slideNumber}
                    busy={editorBusy}
                    originalBackgroundUrl={activeSlide.backgroundImageUrl}
                    onApplyBackground={handleBackgroundUpload}
                    onResetBackground={handleResetBackground}
                    onImageUpload={() => imgFileInputRef.current?.click()}
                  />
                  <button
                    type="button"
                    disabled={editorBusy}
                    onClick={resetEditor}
                    className="mt-2 w-full rounded-md border border-[#e8dfd4] py-2 text-xs font-bold text-[#9a8d82] hover:border-red-300 hover:text-red-500 disabled:opacity-40"
                  >
                    {t('reset_editor')}
                  </button>
                </>
              )}
              <input ref={imgFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageStickerUpload} />

              <div className="rounded-[10px] border border-[#e8dfd4] bg-white p-5 shadow-[0_24px_70px_rgba(31,21,18,0.07)]">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="eyebrow">{t('caption_eyebrow')}</p>
                    <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[#1f1512]">{t('caption_title')}</h2>
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
                    {t('save_caption')}
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
                    <p className="eyebrow">{t('quality_score')}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <div>
                        <div className="text-4xl font-black text-[#1f1512]">
                          {t('quality_points', { score: agentReportData.score })}
                        </div>
                        <p className="mt-1 text-[11px] font-bold text-[#746a62]">
                          {agentReportData.status === 'passed'
                            ? t('quality_passed')
                            : t('quality_review')}
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
                    <h3 className="text-sm font-black text-[#1f1512] mb-5">{t('agent_log_title')}</h3>
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
                  {t('agent_report_legacy')}
                </div>
              )}
            </div>
          )}

          <div className="rounded-[10px] border border-[#d8edf7] bg-[#f3fbff] p-5 text-sm leading-6 text-[#4c6070]">
            <div className="mb-3 flex items-center gap-2 font-black text-[#1f1512]">
              <Download className="h-4 w-4 text-[#2aa2db]" />
              {t('download_title')}
            </div>
            <p className="mb-3">
              {t('download_desc')}
            </p>
            <div className="flex flex-wrap gap-2">
              {activeSlide?.imageUrl && (
                <>
                  <a href={activeSlide.imageUrl} target="_blank" rel="noreferrer" className="btn-secondary min-h-10 px-4 text-xs">
                    <ExternalLink className="h-4 w-4" />
                    {t('open_original')}
                  </a>
                  <button type="button" onClick={downloadActiveSlide} disabled={exporting} className="btn-secondary min-h-10 px-4 text-xs">
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {t('download_current')}
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
                {t('export_zip')}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
