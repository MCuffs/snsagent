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
  searchPexelsBackgroundsAction,
} from '../../../actions'
import type { PexelsBackgroundCandidate } from '../../../../src/lib/ai/providers/pexelsImageProvider'
import type { AgentReport, AgentReportItem } from '../../../../src/lib/carousel/agents'
import { applyBrandStyleMemory, parseEditorialDocument } from '../../../../src/lib/editor/document'
import type { EditorialLayer } from '../../../../src/lib/editor/types'
import { EditorialCanvas, richTextHtmlForEditor } from './editor/EditorialCanvas'
import { EditorialInspector } from './editor/EditorialInspector'
import VideoTrimModal from './editor/VideoTrimModal'
import { exportSlideAsVideo } from './editor/videoExport'
import { useEditorialStore } from './editor/useEditorialStore'
import { analytics } from '../../../../lib/analytics/thinkingdata'
import type { EditorialDocument } from '../../../../src/lib/editor/types'

interface Slide {
  id: string
  slideNumber: number
  headline: string
  body: string
  designPrompt: string
  imageUrl: string | null
  backgroundImageUrl: string | null
  mediaType: 'image' | 'video'
  videoUrl: string | null
  videoThumbnailUrl: string | null
  videoStartSec: number | null
  videoDurationSec: number | null
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

// HEIC/HEIF, BMP 등 서버가 처리할 수 없는 포맷을 Canvas로 JPEG 변환
async function normalizeImageFile(file: File): Promise<File> {
  const supported = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  if (supported.includes(file.type)) return file
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('canvas 미지원')); return }
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('이미지 변환 실패')); return }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
      }, 'image/jpeg', 0.92)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지 로드 실패')) }
    img.src = url
  })
}

function fileNameFor(campaignTitle: string, slideNumber: number, extension = 'png') {
  const safeTitle = campaignTitle
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 48) || 'card-news'
  return `${safeTitle}-${String(slideNumber).padStart(2, '0')}.${extension}`
}

function SlideDocumentThumbnail({ document, fallbackImageUrl, alt }: { document?: EditorialDocument; fallbackImageUrl: string | null; alt: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.1)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => setScale(element.clientWidth / 1080)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  if (!document) {
    if (!fallbackImageUrl) return null
    // Video slide: mp4/webm URL → use <video> tag
    if (/\.(mp4|webm|mov)(\?|$)/i.test(fallbackImageUrl)) {
      return (
        <video
          src={fallbackImageUrl}
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover"
        />
      )
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={fallbackImageUrl} alt={alt} className="h-full w-full object-cover" />
    )
  }

  const background = document.layers.find(layer => layer.type === 'background')
  const overlayLayer = document.layers.find(layer => layer.type === 'overlay')
  const overlay = document.overlay
  const isVideoBackground = Boolean(background?.videoUrl)
  const layers = document.layers
    .filter(layer => !['background', 'overlay'].includes(layer.type) && layer.visible)
    .sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div ref={ref} className="relative h-full w-full overflow-hidden bg-[#090a0d]" aria-label={alt}>
      {background?.visible && (
        background.videoUrl
          ? (
            // Video cardnews: clip video to top half only
            <div className="pointer-events-none absolute left-0 right-0 top-0 overflow-hidden" style={{ height: '50%' }}>
              <video
                key={background.videoUrl}
                src={background.videoUrl}
                autoPlay
                muted
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
                style={{
                  opacity: background.opacity / 100,
                  filter: `blur(${overlay.blur * scale}px) contrast(${overlay.contrast}%)`,
                }}
                onLoadedMetadata={e => {
                  const v = e.currentTarget
                  const start = background.videoStartSec ?? 0
                  const dur = background.videoDurationSec ?? 3
                  const isFullLength = start <= 0.1 && (v.duration ? Math.abs(dur - v.duration) < 0.5 || dur >= v.duration : true)
                  if (isFullLength) {
                    v.loop = true
                  } else {
                    v.loop = false
                  }
                  v.currentTime = start
                  v.play().catch(() => null)
                }}
                onTimeUpdate={e => {
                  const v = e.currentTarget
                  if (v.loop) return
                  const start = background.videoStartSec ?? 0
                  const dur = background.videoDurationSec ?? 3
                  if (v.currentTime >= start + dur) {
                    v.currentTime = start
                  }
                }}
              />
              {/* Gradient fade bottom of video → black */}
              <div className="pointer-events-none absolute bottom-0 left-0 right-0"
                style={{ height: '60%', background: 'linear-gradient(to bottom, transparent 0%, rgba(5,5,8,0.55) 55%, #050508 100%)' }} />
            </div>
          )
          : background.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={background.imageUrl}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              style={{
                opacity: background.opacity / 100,
                filter: `blur(${overlay.blur * scale}px) contrast(${overlay.contrast}%)`,
                transform: `translate(${(background.x ?? 0) * scale}px, ${(background.y ?? 0) * scale}px) scale(${background.scale ?? 1})`,
                transformOrigin: '0 0',
              }}
            />
          )
      )}
      {(!background?.imageUrl && !background?.videoUrl && fallbackImageUrl) && (
        /\.(mp4|webm|mov)(\?|$)/i.test(fallbackImageUrl) ? (
          <video src={fallbackImageUrl} autoPlay loop muted playsInline
            className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fallbackImageUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
        )
      )}
      {/* Video cardnews: solid black bottom half */}
      {isVideoBackground && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0" style={{ height: '50%', background: '#050508' }} />
      )}
      {/* Standard overlay (skip for video cardnews — video has its own gradient) */}
      {!isVideoBackground && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            opacity: (overlayLayer?.opacity ?? 100) / 100,
            background: `radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,${overlay.vignette / 100}) 100%), linear-gradient(180deg, ${hexToRgba(overlay.colorFilter, overlay.darkness / 260)} 0%, rgba(5,5,8,${overlay.darkness / 100}) 100%)`,
            mixBlendMode: overlay.preset === 'dreamy' ? 'soft-light' : 'normal',
          }}
        />
      )}
      {layers.map(layer => (
        <div
          key={layer.id}
          className="absolute overflow-hidden whitespace-pre-wrap break-words"
          style={{
            left: layer.x * scale,
            top: layer.y * scale,
            width: layer.width * scale,
            minHeight: layer.height * scale,
            zIndex: layer.zIndex,
            opacity: layer.opacity / 100,
            transform: `scale(${layer.scale}) rotate(${layer.rotation}deg)`,
            transformOrigin: 'top left',
            color: layer.color,
            fontFamily: fontFamily(layer.fontPreset),
            fontSize: (layer.fontSize || 24) * scale,
            fontWeight: layer.fontWeight,
            lineHeight: layer.lineHeight,
            letterSpacing: (layer.tracking || 0) * scale,
            textAlign: layer.textAlign,
            textShadow: layer.shadow ? `0 ${4 * scale}px ${layer.shadow * scale}px rgba(0,0,0,.58)` : undefined,
            WebkitTextStroke: layer.stroke ? `${layer.stroke * scale}px ${layer.strokeColor}` : undefined,
            background: layer.textBackground,
            fontStyle: layer.italic ? 'italic' : undefined,
            textDecoration: layer.underline ? 'underline' : undefined,
          }}
        >
          {layer.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={layer.imageUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <span dangerouslySetInnerHTML={{ __html: richTextHtmlForEditor(layer, scale) }} />
          )}
        </div>
      ))}
    </div>
  )
}

function fontFamily(preset?: string | null) {
  if (preset === 'serif' || preset === 'magazine') return 'Georgia, "Noto Serif KR", serif'
  if (preset === 'suit') return 'SUIT, Pretendard, sans-serif'
  if (preset === 'noto-sans') return '"Noto Sans KR", Pretendard, sans-serif'
  return 'Pretendard, "Apple SD Gothic Neo", sans-serif'
}

function hexToRgba(hex: string, alpha: number) {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`
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

function downloadBlob(blob: Blob, fileName: string) {
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
  const locale = useLocale()
  const t = useTranslations('campaign')
  // Detect video cardnews campaigns
  const isVideoCardNews = campaign.imageModel?.includes('seedance') ||
    campaign.slides.some(s => s.mediaType === 'video' || Boolean(s.videoUrl))
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
  const [uploadToast, setUploadToast] = useState<{ status: 'uploading' | 'done' | 'error'; text: string; progress: number } | null>(null)
  const [sidebarTab, setSidebarTab] = useState<'edit' | 'agent'>('edit')
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null)
  const documents = useEditorialStore(state => state.documents)
  const dirtySlides = useEditorialStore(state => state.dirtySlides)
  const initializeEditor = useEditorialStore(state => state.initialize)
  const activateSlide = useEditorialStore(state => state.activate)
  const updateDocument = useEditorialStore(state => state.updateDocument)
  const addLayer = useEditorialStore(state => state.addLayer)
  const selectLayer = useEditorialStore(state => state.selectLayer)
  const markSaved = useEditorialStore(state => state.markSaved)

  useEffect(() => {
    analytics.campaignView(campaign.id, {
      campaign_status: campaign.status,
      slide_count: campaign.slideCount,
      image_model: campaign.imageModel,
      plan: planName,
    })
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
      const normalizedFile = await normalizeImageFile(file)
      const formData = new FormData()
      formData.append('files', normalizedFile)
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
      analytics.editorLayerEdit({
        campaignId: campaign.id,
        slideId: activeSlide.id,
        slideNumber: activeSlide.slideNumber,
        layerId: newLayerId,
        layerType: 'sticker',
        editType: 'add_image',
      })
      setMessage({ type: 'success', text: t('message_image_layer_added') })
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, t('message_image_layer_error')) })
    } finally {
      setEditorBusy(false)
    }
  }, [activeDocument, activeSlide, addLayer, campaign.id, selectLayer, t])

  useEffect(() => {
    const pasteHandler = async (e: ClipboardEvent) => {
      if (!activeSlide || !activeDocument) return
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

    window.addEventListener('paste', pasteHandler)
    return () => {
      window.removeEventListener('paste', pasteHandler)
    }
  }, [activeSlide, activeDocument, uploadAndAddImageLayer])

  useEffect(() => {
    const initialDocuments = Object.fromEntries(campaign.slides.map(slide => {
      // Prefer explicit media metadata. Seedance/image URL checks only support legacy rows.
      const legacyVideoUrl = campaign.imageModel?.includes('seedance') ? slide.imageUrl : null
      const videoUrl = slide.videoUrl || legacyVideoUrl
      const isVideoSlide = slide.mediaType === 'video' || Boolean(videoUrl)
      const seed = isVideoSlide
        ? {
            ...slide,
            videoUrl,
            videoThumbnailUrl: slide.videoThumbnailUrl,
            videoStartSec: slide.videoStartSec,
            videoDurationSec: slide.videoDurationSec,
            imageUrl: slide.videoThumbnailUrl,
          }
        : slide
      return [
        slide.id,
        slide.editorDocument
          ? parseEditorialDocument(slide.editorDocument, seed)
          : applyBrandStyleMemory(parseEditorialDocument(null, seed), brand.editorPreferences),
      ]
    }))
    if (campaign.slides[0]) initializeEditor(initialDocuments, campaign.slides[0].id)
  }, [brand.editorPreferences, campaign.imageModel, campaign.slides, initializeEditor])

  useEffect(() => {
    if (!activeSlide || !activeDocument || !dirtySlides[activeSlide.id] || editorBusy) return
    const timeout = window.setTimeout(async () => {
      try {
        const result = await saveEditorialDocumentAction(activeSlide.id, JSON.stringify(activeDocument), false)
        analytics.editorDocumentSave({
          campaignId: campaign.id,
          slideId: activeSlide.id,
          slideNumber: activeSlide.slideNumber,
          saveType: 'autosave',
          renderOutput: false,
          success: result.success,
          reason: result.success ? undefined : result.error,
        })
        if (result.success) markSaved(activeSlide.id)
      } catch (err) {
        console.error('[autosave] Server Action failed:', err)
      }
    }, 900)
    return () => window.clearTimeout(timeout)
  }, [activeDocument, activeSlide, campaign.id, dirtySlides, editorBusy, markSaved])

  const selectSlide = (index: number) => {
    setActiveSlideIndex(index)
    if (slides[index]) {
      activateSlide(slides[index].id)
      analytics.slideSelect(campaign.id, slides[index].id, slides[index].slideNumber, slides.length)
    }
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
    const slideId = activeSlide.id
    const docSnapshot = activeDocument

    setUploadToast({ status: 'uploading', text: '이미지 업로드 중', progress: 0 })

    try {
      const normalizedFile = await normalizeImageFile(file)

      // XHR로 업로드 — progress 이벤트 활용
      const backgroundUrl = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        const formData = new FormData()
        formData.append('files', normalizedFile)

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 55)
            setUploadToast({ status: 'uploading', text: '이미지 업로드 중', progress: pct })
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText) as { urls?: string[]; error?: string }
              if (data.urls?.[0]) resolve(data.urls[0])
              else reject(new Error(data.error || '업로드 실패'))
            } catch {
              reject(new Error('응답 파싱 실패'))
            }
          } else {
            reject(new Error(`HTTP ${xhr.status}`))
          }
        })
        xhr.addEventListener('error', () => reject(new Error('네트워크 오류')))
        xhr.open('POST', '/api/upload')
        xhr.send(formData)
      })

      setUploadToast({ status: 'uploading', text: '배경 적용 중', progress: 60 })

      const nextDocument = {
        ...docSnapshot,
        layers: docSnapshot.layers.map(layer =>
          layer.type === 'background'
            ? { ...layer, imageUrl: backgroundUrl, videoUrl: null, videoThumbnailUrl: null, videoStartSec: undefined, videoDurationSec: undefined, scale, x: Math.round(offsetX * (1080 - 1080 * scale)), y: Math.round(offsetY * (1350 - 1350 * scale)) }
            : layer
        ),
      }
      updateDocument(slideId, () => nextDocument)

      setUploadToast({ status: 'uploading', text: '카드에 반영 중', progress: 80 })

      const result = await saveEditorialDocumentAction(slideId, JSON.stringify(nextDocument), true)
      if (!result.success) {
        analytics.backgroundUpload({
          campaignId: campaign.id,
          slideId,
          slideNumber: activeSlide.slideNumber,
          fileType: file.type,
          fileSize: file.size,
          success: false,
          reason: result.error,
        })
        setUploadToast({ status: 'error', text: result.error || t('message_background_error'), progress: 0 })
        setTimeout(() => setUploadToast(null), 4000)
        return
      }

      setUploadToast({ status: 'uploading', text: '완료 중', progress: 95 })
      applyServerSlide(result.slide as Slide, result.document)
      analytics.backgroundUpload({
        campaignId: campaign.id,
        slideId,
        slideNumber: activeSlide.slideNumber,
        fileType: file.type,
        fileSize: file.size,
        success: true,
      })

      setUploadToast({ status: 'done', text: '배경 이미지가 적용됐습니다', progress: 100 })
      setTimeout(() => setUploadToast(null), 2500)

    } catch (error) {
      analytics.backgroundUpload({
        campaignId: campaign.id,
        slideId,
        slideNumber: activeSlide.slideNumber,
        fileType: file.type,
        fileSize: file.size,
        success: false,
        reason: getErrorMessage(error, t('message_background_save_error')),
      })
      setUploadToast({ status: 'error', text: getErrorMessage(error, t('message_background_save_error')), progress: 0 })
      setTimeout(() => setUploadToast(null), 4000)
    }
  }

  const handleVideoBackgroundUpload = async (file: File, startSec: number, durationSec: number) => {
    if (!activeSlide || !activeDocument) return
    const slideId = activeSlide.id
    const docSnapshot = activeDocument

    setUploadToast({ status: 'uploading', text: '영상 업로드 중', progress: 0 })

    try {
      // 1. 영상 원본 업로드
      const videoUrl = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        const formData = new FormData()
        formData.append('files', file)
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 50)
            setUploadToast({ status: 'uploading', text: '영상 업로드 중', progress: pct })
          }
        })
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText) as { urls?: string[]; error?: string }
              if (data.urls?.[0]) resolve(data.urls[0])
              else reject(new Error(data.error || '업로드 실패'))
            } catch { reject(new Error('응답 파싱 실패')) }
          } else {
            reject(new Error(`HTTP ${xhr.status}`))
          }
        })
        xhr.addEventListener('error', () => reject(new Error('네트워크 오류')))
        xhr.open('POST', '/api/upload')
        xhr.send(formData)
      })

      setUploadToast({ status: 'uploading', text: '썸네일 생성 중', progress: 55 })

      // 2. 첫 프레임 캡처 → 이미지로 업로드 (export용)
      const thumbnailUrl = await new Promise<string>((resolve, reject) => {
        const video = window.document.createElement('video')
        video.src = URL.createObjectURL(file)
        video.muted = true
        video.playsInline = true
        video.preload = 'metadata'
        video.addEventListener('loadeddata', () => { video.currentTime = 0 })
        video.addEventListener('seeked', () => {
          const canvas = window.document.createElement('canvas')
          canvas.width = 1080
          canvas.height = 1350
          const ctx = canvas.getContext('2d')
          if (!ctx) { reject(new Error('canvas 초기화 실패')); return }
          // 4:5 비율로 center-crop
          const vw = video.videoWidth
          const vh = video.videoHeight
          const targetRatio = 1080 / 1350
          const srcRatio = vw / vh
          let sx = 0, sy = 0, sw = vw, sh = vh
          if (srcRatio > targetRatio) { sw = vh * targetRatio; sx = (vw - sw) / 2 }
          else { sh = vw / targetRatio; sy = (vh - sh) / 2 }
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 1080, 1350)
          URL.revokeObjectURL(video.src)
          canvas.toBlob(async (blob) => {
            if (!blob) { reject(new Error('프레임 캡처 실패')); return }
            const thumbFile = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' })
            const thumbForm = new FormData()
            thumbForm.append('files', thumbFile)
            try {
              const res = await fetch('/api/upload', { method: 'POST', body: thumbForm })
              const data = await res.json() as { urls?: string[]; error?: string }
              if (data.urls?.[0]) resolve(data.urls[0])
              else reject(new Error(data.error || '썸네일 업로드 실패'))
            } catch (err) { reject(err) }
          }, 'image/jpeg', 0.88)
        })
        video.addEventListener('error', () => reject(new Error('영상 로드 실패')))
        video.load()
      })

      setUploadToast({ status: 'uploading', text: '배경 적용 중', progress: 80 })

      // 3. 레이어 업데이트 — imageUrl을 썸네일로 교체해 export 파이프라인이 그대로 동작
      const nextDocument = {
        ...docSnapshot,
        layers: docSnapshot.layers.map(layer =>
          layer.type === 'background'
            ? { ...layer, videoUrl, videoThumbnailUrl: thumbnailUrl, imageUrl: thumbnailUrl, videoStartSec: startSec, videoDurationSec: durationSec }
            : layer
        ),
      }
      updateDocument(slideId, () => nextDocument)

      const result = await saveEditorialDocumentAction(slideId, JSON.stringify(nextDocument), true)
      if (!result.success) {
        setUploadToast({ status: 'error', text: result.error || '저장에 실패했습니다.', progress: 0 })
        setTimeout(() => setUploadToast(null), 4000)
        return
      }

      applyServerSlide(result.slide as Slide, result.document)
      setUploadToast({ status: 'done', text: '영상 배경이 적용됐습니다', progress: 100 })
      setTimeout(() => setUploadToast(null), 2500)

    } catch (error) {
      setUploadToast({ status: 'error', text: getErrorMessage(error, '영상 업로드 중 오류가 발생했습니다.'), progress: 0 })
      setTimeout(() => setUploadToast(null), 4000)
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
          layer.type === 'background' ? { ...layer, imageUrl: originalUrl, videoUrl: null, videoThumbnailUrl: null } : layer
        ),
      }
      updateDocument(activeSlide.id, () => nextDocument)
      const result = await saveEditorialDocumentAction(activeSlide.id, JSON.stringify(nextDocument), true)
      if (!result.success) {
        analytics.editorDocumentSave({
          campaignId: campaign.id,
          slideId: activeSlide.id,
          slideNumber: activeSlide.slideNumber,
          saveType: 'manual',
          renderOutput: true,
          success: false,
          reason: result.error,
        })
        setMessage({ type: 'error', text: result.error || t('message_background_error') })
        return
      }
      applyServerSlide(result.slide as Slide, result.document)
      analytics.editorDocumentSave({
        campaignId: campaign.id,
        slideId: activeSlide.id,
        slideNumber: activeSlide.slideNumber,
        saveType: 'manual',
        renderOutput: true,
        success: true,
      })
      setMessage({ type: 'success', text: '원래 배경으로 복원했습니다.' })
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, t('message_background_save_error')) })
    } finally {
      setEditorBusy(false)
    }
  }

  const handlePexelsBackgroundSelect = async (image: PexelsBackgroundCandidate) => {
    if (!activeSlide || !activeDocument) return
    const slideId = activeSlide.id
    setEditorBusy(true)
    setMessage(null)
    setUploadToast({ status: 'uploading', text: 'Pexels 배경 적용 중', progress: 55 })

    try {
      const nextDocument = {
        ...activeDocument,
        layers: activeDocument.layers.map(layer =>
          layer.type === 'background'
            ? { ...layer, imageUrl: image.imageUrl, videoUrl: null, videoThumbnailUrl: null, videoStartSec: undefined, videoDurationSec: undefined, scale: 1, x: 0, y: 0 }
            : layer
        ),
      }
      updateDocument(slideId, () => nextDocument)
      setUploadToast({ status: 'uploading', text: '카드에 반영 중', progress: 80 })
      const result = await saveEditorialDocumentAction(slideId, JSON.stringify(nextDocument), true)
      if (!result.success) {
        setUploadToast({ status: 'error', text: result.error || t('message_background_error'), progress: 0 })
        setTimeout(() => setUploadToast(null), 4000)
        return
      }
      applyServerSlide(result.slide as Slide, result.document)
      setUploadToast({ status: 'done', text: 'Pexels 배경이 적용됐습니다', progress: 100 })
      setTimeout(() => setUploadToast(null), 2500)
    } catch (error) {
      setUploadToast({ status: 'error', text: getErrorMessage(error, t('message_background_save_error')), progress: 0 })
      setTimeout(() => setUploadToast(null), 4000)
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
        analytics.captionSave({
          campaignId: campaign.id,
          postId: post.id,
          captionLength: caption.length,
          hashtagCount: hashtags.split(/\s+/).filter(Boolean).length,
          success: false,
          reason: result.error,
        })
        setMessage({ type: 'error', text: result.error || t('message_caption_error') })
        return
      }
      analytics.captionSave({
        campaignId: campaign.id,
        postId: post.id,
        captionLength: caption.length,
        hashtagCount: hashtags.split(/\s+/).filter(Boolean).length,
        success: true,
      })
      setMessage({ type: 'success', text: t('message_caption_saved') })
      router.refresh()
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, t('message_caption_save_error')) })
    } finally {
      setSavingCaption(false)
    }
  }

  // ✅ 텍스트 편집 중 다운로드 뺄리 방지: export 전 contentEditable blur() 실행
  // onInput으로 이미 실시간 store 동기화되지만, React가 다음 렌더링 전에 상태를
  // 읽는 틀사이를 대비해 blur()로 flush한 후 소액의 React 스케줄링 대기
  const flushActiveTextEdit = (): Promise<void> => {
    return new Promise(resolve => {
      const el = globalThis.document?.activeElement as HTMLElement | null
      if (el?.isContentEditable) {
        el.blur() // onBlur 핸들러가 실행되면서 store를 flush
        // blur 후 React가 state를 flush할 수 있도록 다음 탁에 양보
        setTimeout(resolve, 30)
      } else {
        resolve()
      }
    })
  }

  const downloadActiveSlide = async () => {
    if (!activeSlide || (!activeSlide.imageUrl && !activeSlide.videoUrl && !activeDocument)) return
    await flushActiveTextEdit()
    setExporting(true)
    setMessage(null)

    const bgLayer = activeDocument?.layers.find(l => l.type === 'background')
    const isVideoSlide = Boolean(bgLayer?.videoUrl)
    const format = isVideoSlide ? 'mp4' : 'png'

    analytics.campaignDownload(campaign.id, format, 1, {
      export_scale: 1,
      slide_number: activeSlide.slideNumber,
      download_scope: 'single_slide',
    })
    try {
      if (isVideoSlide && activeDocument && bgLayer?.videoUrl) {
        // 영상 슬라이드 — 클라이언트 canvas 합성
        setMessage({ type: 'success', text: '영상 합성 중… 잠시 기다려주세요.' })
        const exportedVideo = await exportSlideAsVideo({
          videoUrl: bgLayer.videoUrl,
          videoStartSec: bgLayer.videoStartSec ?? 0,
          videoDurationSec: bgLayer.videoDurationSec ?? 3,
          document: activeDocument,
          brandName: brand.name,
        })
        downloadBlob(exportedVideo.blob, fileNameFor(campaign.title, activeSlide.slideNumber, exportedVideo.extension))
        setMessage({ type: 'success', text: '영상 다운로드가 완료됐습니다.' })
      } else if (activeDocument) {
        const result = await exportEditorialSlideAction(activeSlide.id, JSON.stringify(activeDocument), 'png', 1)
        if (!result.success) {
          analytics.exportComplete({ campaignId: campaign.id, slideId: activeSlide.id, format: 'png', scale: 1, downloadScope: 'single_slide', success: false, reason: result.error })
          return setMessage({ type: 'error', text: result.error })
        }
        await downloadImage(result.url, fileNameFor(campaign.title, activeSlide.slideNumber))
      } else {
        if (!activeSlide.imageUrl) throw new Error('다운로드할 이미지가 없습니다.')
        await downloadImage(activeSlide.imageUrl, fileNameFor(campaign.title, activeSlide.slideNumber))
      }
      analytics.exportComplete({ campaignId: campaign.id, slideId: activeSlide.id, format, scale: 1, downloadScope: 'single_slide', success: true })
    } catch (error) {
      analytics.exportComplete({ campaignId: campaign.id, slideId: activeSlide.id, format, scale: 1, downloadScope: 'single_slide', success: false, reason: getErrorMessage(error, t('message_download_error')) })
      setMessage({ type: 'error', text: getErrorMessage(error, t('message_download_error')) })
    } finally {
      setExporting(false)
    }
  }

  const exportActive = async (format: 'png' | 'jpg', scale: 1 | 2) => {
    if (!activeSlide || !activeDocument) return
    // 편집 중인 텍스트를 먼저 store에 flush
    await flushActiveTextEdit()
    setExporting(true)
    setMessage(null)
    analytics.campaignDownload(campaign.id, format, 1, {
      export_scale: scale,
      slide_number: activeSlide.slideNumber,
      download_scope: 'single_slide',
    })
    try {
      const result = await exportEditorialSlideAction(activeSlide.id, JSON.stringify(activeDocument), format, scale)
      if (!result.success) {
        analytics.exportComplete({
          campaignId: campaign.id,
          slideId: activeSlide.id,
          format,
          scale,
          downloadScope: 'single_slide',
          success: false,
          reason: result.error,
        })
        return setMessage({ type: 'error', text: result.error })
      }
      await downloadImage(result.url, fileNameFor(campaign.title, activeSlide.slideNumber, format))
      analytics.exportComplete({
        campaignId: campaign.id,
        slideId: activeSlide.id,
        format,
        scale,
        downloadScope: 'single_slide',
        success: true,
      })
      setMessage({ type: 'success', text: scale === 2 ? t('message_export_done_2x', { format: format.toUpperCase() }) : t('message_export_done', { format: format.toUpperCase() }) })
    } catch (error) {
      analytics.exportComplete({
        campaignId: campaign.id,
        slideId: activeSlide.id,
        format,
        scale,
        downloadScope: 'single_slide',
        success: false,
        reason: getErrorMessage(error, t('message_export_error')),
      })
      setMessage({ type: 'error', text: getErrorMessage(error, t('message_export_error')) })
    } finally {
      setExporting(false)
    }
  }

  const exportZip = async () => {
    setDownloadingAll(true)
    setMessage(null)
    // 편집 중인 텍스트를 먼저 store에 flush (현재 활성 슬라이드가 열린 싄 보호)
    await flushActiveTextEdit()
    analytics.campaignDownload(campaign.id, 'zip', slides.length, {
      export_scale: 1,
      download_scope: 'all_slides',
    })
    try {
      const zip = new JSZip()
      const results = await Promise.all(
        slides.map(async slide => {
          const doc = documents[slide.id]
          const bgLayer = doc?.layers.find(l => l.type === 'background')
          // 영상 배경 슬라이드 — 클라이언트 canvas 합성
          if (bgLayer?.videoUrl && doc) {
            const exportedVideo = await exportSlideAsVideo({
              videoUrl: bgLayer.videoUrl,
              videoStartSec: bgLayer.videoStartSec ?? 0,
              videoDurationSec: bgLayer.videoDurationSec ?? 3,
              document: doc,
              brandName: brand.name,
            })
            return { name: fileNameFor(campaign.title, slide.slideNumber, exportedVideo.extension), blob: exportedVideo.blob }
          }
          // 이미지 슬라이드 — 기존 서버 PNG 렌더
          const result = await exportEditorialSlideAction(slide.id, JSON.stringify(doc || slide), 'png', 1)
          if (!result.success) throw new Error(result.error)
          const response = await fetch(result.url, { cache: 'force-cache' })
          return { name: fileNameFor(campaign.title, slide.slideNumber), blob: await response.blob() }
        })
      )
      for (const { name, blob } of results) zip.file(name, blob)
      const archive = await zip.generateAsync({ 
        type: 'blob',
        compression: 'STORE', // No compression for speed (PNGs are already compressed)
      })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(archive)
      link.download = `${campaign.title.replace(/\s+/g, '-')}-instagram-4x5.zip`
      link.click()
      URL.revokeObjectURL(link.href)
      analytics.exportComplete({
        campaignId: campaign.id,
        format: 'zip',
        scale: 1,
        downloadScope: 'all_slides',
        success: true,
      })
      setMessage({ type: 'success', text: t('message_zip_done') })
    } catch (error) {
      analytics.exportComplete({
        campaignId: campaign.id,
        format: 'zip',
        scale: 1,
        downloadScope: 'all_slides',
        success: false,
        reason: getErrorMessage(error, t('message_zip_error')),
      })
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
      analytics.editorLayerEdit({
        campaignId: campaign.id,
        slideId: activeSlide.id,
        slideNumber: activeSlide.slideNumber,
        editType: 'reset_editor',
      })
      setMessage({ type: 'success', text: t('message_reset_done') })
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, t('message_reset_error')) })
    } finally {
      setEditorBusy(false)
    }
  }

  return (
    <div
      className="mx-auto max-w-[1500px] px-5 py-8 md:px-8"
      style={isVideoCardNews ? {
        background: 'linear-gradient(135deg, #ffffff 0%, #f4f8ff 30%, #eaf1ff 65%, #e2ecfe 100%)',
        minHeight: '100%',
        borderRadius: '0',
      } : undefined}
    >
      {/* 영상 트림 모달 */}
      {pendingVideoFile && (
        <VideoTrimModal
          file={pendingVideoFile}
          onConfirm={({ file, startSec, durationSec }) => {
            setPendingVideoFile(null)
            void handleVideoBackgroundUpload(file, startSec, durationSec)
          }}
          onCancel={() => setPendingVideoFile(null)}
        />
      )}
      {/* 배경 업로드 토스트 — 화면 상단 고정 */}
      {uploadToast && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 w-72 rounded-2xl shadow-2xl overflow-hidden">
          <div className={`flex items-center gap-3 px-4 py-3 ${
            uploadToast.status === 'error' ? 'bg-red-600' : 'bg-[#111318]'
          }`}>
            {uploadToast.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin shrink-0 text-white" />}
            {uploadToast.status === 'done' && <Check className="h-4 w-4 shrink-0 text-emerald-400" />}
            <span className="flex-1 text-sm font-bold text-white">{uploadToast.text}</span>
            {uploadToast.status === 'uploading' && (
              <span className="text-xs font-black text-white/70 tabular-nums">{uploadToast.progress}%</span>
            )}
          </div>
          {uploadToast.status === 'uploading' && (
            <div className="h-1 bg-white/10">
              <div
                className="h-full bg-[#0066ff] transition-all duration-300 ease-out"
                style={{ width: `${uploadToast.progress}%` }}
              />
            </div>
          )}
          {uploadToast.status === 'done' && <div className="h-1 bg-emerald-500" />}
        </div>
      )}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          {isVideoCardNews ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-[#c0d0f5] bg-[#eef4ff] px-3 py-1.5 text-xs font-bold text-[#3b5bdb] shadow-sm mb-3">
              <span className="flex h-1.5 w-1.5 rounded-full bg-[#4c6ef5] animate-pulse" />
              VIDEO CARD NEWS STUDIO
            </div>
          ) : (
            <p className="eyebrow">{t('page_eyebrow')}</p>
          )}
          <h1 className={`mt-2 max-w-4xl text-4xl font-black leading-[1.2] tracking-[-0.03em] md:text-5xl ${
            isVideoCardNews ? 'text-[#1a2a5e]' : 'text-[#1f1512]'
          }`}>
            {campaign.title}
          </h1>
          <p className={`mt-3 max-w-2xl text-sm leading-6 ${isVideoCardNews ? 'text-[#5a6ea8]' : 'text-[#746a62]'}`}>
            {isVideoCardNews
              ? 'AI가 생성한 영상 슬라이드를 확인하고, 텍스트를 직접 편집한 뒤 다운로드하세요.'
              : t('page_desc')}
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
                  <SlideDocumentThumbnail
                    document={documents[slide.id]}
                    fallbackImageUrl={slide.imageUrl}
                    alt={t('thumbnail_alt', { number: slide.slideNumber })}
                  />
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
                    onApplyVideoBackground={(file) => setPendingVideoFile(file)}
                    onApplyPexelsBackground={handlePexelsBackgroundSelect}
                    onLoadPexelsBackgrounds={searchPexelsBackgroundsAction}
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
              {(activeSlide?.imageUrl || activeSlide?.videoUrl) && (
                <>
                  <a href={activeSlide.videoUrl || activeSlide.imageUrl || '#'} target="_blank" rel="noreferrer" className="btn-secondary min-h-10 px-4 text-xs">
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
