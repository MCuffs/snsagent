import type { EditorialDocument, EditorialLayer, FontPreset } from '../../../../../src/lib/editor/types'

function fontFamilyForPreset(preset?: FontPreset | null) {
  switch (preset) {
    case 'serif':
    case 'magazine':
      return 'Georgia, Times New Roman, Noto Serif KR, serif'
    case 'suit':
      return 'SUIT, Pretendard, Noto Sans KR, sans-serif'
    case 'noto-sans':
      return 'Noto Sans KR, Pretendard, sans-serif'
    default:
      return 'Pretendard, Apple SD Gothic Neo, Noto Sans KR, sans-serif'
  }
}

export interface VideoExportParams {
  videoUrl: string
  videoStartSec: number
  videoDurationSec: number
  document: EditorialDocument
  brandName?: string
}

export interface VideoExportResult {
  blob: Blob
  extension: 'mp4' | 'webm'
  mimeType: string
}

function drawTextLayer(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, layer: EditorialLayer) {
  const text = layer.text || ''
  if (!text.trim()) return

  const fontFamily = fontFamilyForPreset(layer.fontPreset)
  const fontSize = layer.fontSize ?? 36
  const color = layer.color ?? '#ffffff'
  const opacity = (layer.opacity ?? 100) / 100
  const lineHeight = (layer.lineHeight ?? 1.25) * fontSize
  const maxWidth = layer.width || 960

  ctx.save()
  ctx.globalAlpha = opacity
  ctx.font = `${layer.italic ? 'italic ' : ''}${layer.fontWeight ?? 400} ${fontSize}px ${fontFamily}`
  ctx.fillStyle = color
  ctx.textBaseline = 'top'

  if (layer.stroke && layer.strokeColor) {
    ctx.strokeStyle = layer.strokeColor
    ctx.lineWidth = layer.stroke * 2
    ctx.lineJoin = 'round'
  }

  const anchorX = layer.textAlign === 'center'
    ? layer.x + layer.width / 2
    : layer.textAlign === 'right'
      ? layer.x + layer.width
      : layer.x

  if (layer.textAlign === 'center') ctx.textAlign = 'center'
  else if (layer.textAlign === 'right') ctx.textAlign = 'right'
  else ctx.textAlign = 'left'

  if (layer.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 16
    ctx.shadowOffsetY = 8
  }

  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)

  const finalLines = lines.flatMap(l => l.split('\n'))
  let curY = layer.y
  for (const line of finalLines) {
    if (layer.stroke && layer.strokeColor) ctx.strokeText(line, anchorX, curY)
    ctx.fillText(line, anchorX, curY)
    curY += lineHeight
  }

  ctx.restore()
}

export async function exportSlideAsVideo(params: VideoExportParams): Promise<VideoExportResult> {
  const { videoUrl, videoStartSec, videoDurationSec, document: doc } = params
  const W = 1080
  const H = 1350
  const FPS = 30

  let sourceResponse: Response
  try {
    sourceResponse = await fetch(videoUrl, { cache: 'no-store', credentials: 'same-origin' })
  } catch {
    throw new Error('영상 저장소에 연결하지 못했습니다. CORS 또는 네트워크 설정을 확인해 주세요.')
  }
  if (!sourceResponse.ok) {
    throw new Error(`영상 파일을 불러오지 못했습니다. (HTTP ${sourceResponse.status})`)
  }

  const sourceBlob = await sourceResponse.blob()
  if (!sourceBlob.size) throw new Error('영상 파일이 비어 있습니다.')

  const sourceObjectUrl = URL.createObjectURL(sourceBlob)
  const video = window.document.createElement('video')
  video.src = sourceObjectUrl
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('브라우저가 영상 코덱을 재생하지 못했습니다.'))
      video.load()
    })

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('영상 렌더링 캔버스를 만들지 못했습니다.')

    const format = MediaRecorder.isTypeSupported('video/mp4')
      ? { mimeType: 'video/mp4', extension: 'mp4' as const }
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? { mimeType: 'video/webm;codecs=vp9', extension: 'webm' as const }
        : MediaRecorder.isTypeSupported('video/webm')
          ? { mimeType: 'video/webm', extension: 'webm' as const }
          : null

    if (!format) {
      throw new Error('이 브라우저는 영상 내보내기를 지원하지 않습니다.')
    }

    const textLayers = doc.layers
      .filter((l: EditorialLayer) => l.visible && ['title', 'subtitle', 'text', 'cta', 'watermark'].includes(l.type))
      .sort((a: EditorialLayer, b: EditorialLayer) => a.zIndex - b.zIndex)
    const bgLayer = doc.layers.find((l: EditorialLayer) => l.type === 'background')
    const bgScale = bgLayer?.scale ?? 1
    const bgX = bgLayer?.x ?? 0
    const bgY = bgLayer?.y ?? 0
    const bgOpacity = (bgLayer?.opacity ?? 100) / 100

    const drawFrame = () => {
      ctx.fillStyle = '#050508'
      ctx.fillRect(0, 0, W, H)

      ctx.save()
      ctx.globalAlpha = bgOpacity
      ctx.translate(bgX, bgY)
      ctx.scale(bgScale, bgScale)

      const videoHeight = H / 2
      const vw = video.videoWidth || W
      const vh = video.videoHeight || H
      const targetRatio = W / videoHeight
      const srcRatio = vw / vh
      let sx = 0
      let sy = 0
      let sw = vw
      let sh = vh
      if (srcRatio > targetRatio) {
        sw = vh * targetRatio
        sx = (vw - sw) / 2
      } else {
        sh = vw / targetRatio
        sy = (vh - sh) / 2
      }
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W / bgScale, videoHeight / bgScale)

      const gradient = ctx.createLinearGradient(0, videoHeight * 0.4, 0, videoHeight)
      gradient.addColorStop(0, 'rgba(5,5,8,0)')
      gradient.addColorStop(0.55, 'rgba(5,5,8,0.55)')
      gradient.addColorStop(1, 'rgba(5,5,8,1)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, W / bgScale, videoHeight / bgScale)

      ctx.restore()

      for (const layer of textLayers) {
        drawTextLayer(ctx, layer)
      }
    }

    const seekVideo = (targetTime: number): Promise<void> => {
      return new Promise((resolve, reject) => {
        const maxTime = Number.isFinite(video.duration) ? video.duration : targetTime
        const clampedTime = Math.max(0, Math.min(targetTime, maxTime))
        if (Math.abs(video.currentTime - clampedTime) < 0.04) {
          resolve()
          return
        }

        const timeout = window.setTimeout(() => {
          cleanup()
          resolve()
        }, 2500)
        const cleanup = () => {
          window.clearTimeout(timeout)
          video.removeEventListener('seeked', onSeeked)
          video.removeEventListener('error', onError)
        }
        const onSeeked = () => {
          cleanup()
          resolve()
        }
        const onError = () => {
          cleanup()
          reject(new Error('브라우저가 영상 코덱을 재생하지 못했습니다.'))
        }

        video.addEventListener('seeked', onSeeked)
        video.addEventListener('error', onError)
        video.currentTime = clampedTime
      })
    }

    const exportStartSec = Math.max(0, Math.min(videoStartSec, Number.isFinite(video.duration) ? video.duration : videoStartSec))
    await seekVideo(exportStartSec)
    drawFrame()

    const stream = canvas.captureStream(FPS)
    const recorder = new MediaRecorder(stream, { mimeType: format.mimeType, videoBitsPerSecond: 10_000_000 })
    const chunks: Blob[] = []

    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    await new Promise<void>((resolve, reject) => {
      let animationId = 0
      let stopTimer = 0
      let stopRequested = false

      const stopRecording = () => {
        if (stopRequested) return
        stopRequested = true
        window.cancelAnimationFrame(animationId)
        window.clearTimeout(stopTimer)
        video.pause()
        if (recorder.state !== 'inactive') recorder.stop()
      }

      recorder.onerror = () => {
        stopRecording()
        reject(new Error('영상 녹화에 실패했습니다.'))
      }
      recorder.onstop = () => {
        resolve()
      }

      const renderFrame = () => {
        drawFrame()
        animationId = window.requestAnimationFrame(renderFrame)
      }

      recorder.start(1000)
      video.currentTime = exportStartSec
      video.play()
        .then(() => {
          renderFrame()
          stopTimer = window.setTimeout(stopRecording, Math.ceil(videoDurationSec * 1000))
        })
        .catch(error => {
          stopRecording()
          reject(error)
        })
    })

    stream.getTracks().forEach(track => track.stop())

    if (chunks.length === 0) {
      throw new Error('영상 녹화에 실패했습니다. 브라우저가 이 코덱을 지원하지 않을 수 있습니다.')
    }

    return {
      blob: new Blob(chunks, { type: format.mimeType }),
      extension: format.extension,
      mimeType: format.mimeType,
    }
  } finally {
    video.pause()
    URL.revokeObjectURL(sourceObjectUrl)
  }
}
