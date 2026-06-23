import type { EditorialDocument, EditorialLayer, FontPreset } from '../../../../../src/lib/editor/types'

// renderer.ts는 서버 전용(resvg/sharp/fs) — 클라이언트 번들에서 import 불가
// fontFamilyForPreset만 인라인으로 복사
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

// 텍스트 레이어를 canvas에 직접 그림 (서버 SVG 렌더 없이)
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

  // 텍스트 정렬
  const anchorX = layer.textAlign === 'center'
    ? layer.x + layer.width / 2
    : layer.textAlign === 'right'
      ? layer.x + layer.width
      : layer.x

  if (layer.textAlign === 'center') ctx.textAlign = 'center'
  else if (layer.textAlign === 'right') ctx.textAlign = 'right'
  else ctx.textAlign = 'left'

  // 그림자
  if (layer.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 16
    ctx.shadowOffsetY = 8
  }

  // 단순 줄바꿈 처리 (긴 텍스트 wordwrap)
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
  // 명시적 줄바꿈도 처리
  const finalLines = lines.flatMap(l => l.split('\n'))

  let curY = layer.y
  for (const line of finalLines) {
    if (layer.stroke && layer.strokeColor) ctx.strokeText(line, anchorX, curY)
    ctx.fillText(line, anchorX, curY)
    curY += lineHeight
  }

  ctx.restore()
}

function drawOverlay(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  overlay: EditorialDocument['overlay'],
  width: number,
  height: number,
  opacity: number,
) {
  ctx.save()
  ctx.globalAlpha = opacity

  // 어둠 그라디언트
  const darkness = overlay.darkness / 100
  const grad = ctx.createLinearGradient(0, 0, 0, height)
  const colorFilter = overlay.colorFilter || '#000000'
  grad.addColorStop(0, hexToRgba(colorFilter, darkness * 0.4))
  grad.addColorStop(1, `rgba(5,5,8,${darkness})`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)

  // 비네팅
  if (overlay.vignette > 0) {
    const vigAlpha = overlay.vignette / 100
    const vig = ctx.createRadialGradient(width / 2, height / 2, height * 0.25, width / 2, height / 2, height * 0.7)
    vig.addColorStop(0, 'rgba(0,0,0,0)')
    vig.addColorStop(1, `rgba(0,0,0,${vigAlpha})`)
    ctx.fillStyle = vig
    ctx.fillRect(0, 0, width, height)
  }

  ctx.restore()
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16) || 0
  const g = parseInt(clean.slice(2, 4), 16) || 0
  const b = parseInt(clean.slice(4, 6), 16) || 0
  return `rgba(${r},${g},${b},${alpha})`
}

export async function exportSlideAsVideo(params: VideoExportParams): Promise<Blob> {
  const { videoUrl, videoStartSec, videoDurationSec, document: doc } = params
  const W = 1080
  const H = 1350
  const FPS = 30
  const totalFrames = Math.ceil(videoDurationSec * FPS)

  // 1. 영상 로드
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

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => {
      URL.revokeObjectURL(sourceObjectUrl)
      reject(new Error('브라우저가 영상 코덱을 재생하지 못했습니다.'))
    }
    video.load()
  })

  // 2. canvas + MediaRecorder 설정
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // 지원 포맷 결정 (Chrome: webm/vp9, Safari: mp4/h264)
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : MediaRecorder.isTypeSupported('video/mp4')
        ? 'video/mp4'
        : null

  if (!mimeType) {
    URL.revokeObjectURL(sourceObjectUrl)
    throw new Error('이 브라우저는 영상 내보내기를 지원하지 않습니다.')
  }

  const stream = canvas.captureStream(FPS)
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 })
  const chunks: Blob[] = []
  let recorderStopped = false
  
  recorder.ondataavailable = e => {
    if (e.data.size > 0 && !recorderStopped) chunks.push(e.data)
  }
  
  recorder.onstop = () => {
    recorderStopped = true
  }

  const overlayLayer = doc.layers.find((l: EditorialLayer) => l.type === 'overlay')
  const overlayOpacity = (overlayLayer?.opacity ?? 100) / 100
  const textLayers = doc.layers
    .filter((l: EditorialLayer) => l.visible && ['title', 'subtitle', 'text', 'cta', 'watermark'].includes(l.type))
    .sort((a: EditorialLayer, b: EditorialLayer) => a.zIndex - b.zIndex)
  const bgLayer = doc.layers.find((l: EditorialLayer) => l.type === 'background')
  const bgScale = bgLayer?.scale ?? 1
  const bgX = bgLayer?.x ?? 0
  const bgY = bgLayer?.y ?? 0
  const bgOpacity = (bgLayer?.opacity ?? 100) / 100

  // Helper: wait for video seek with timeout
  const seekVideo = (targetTime: number): Promise<void> => {
    return new Promise((resolve) => {
      // Already at target time - no seek needed
      if (Math.abs(video.currentTime - targetTime) < 0.04) {
        resolve()
        return
      }
      
      video.currentTime = targetTime
      
      const timeout = setTimeout(() => {
        video.removeEventListener('seeked', onSeeked)
        resolve()
      }, 2000)
      
      const onSeeked = () => {
        clearTimeout(timeout)
        video.removeEventListener('seeked', onSeeked)
        resolve()
      }
      
      video.addEventListener('seeked', onSeeked)
    })
  }

  // 3. 프레임별 렌더링
  await new Promise<void>((resolve, reject) => {
    recorder.start()

    let frameCount = 0

    const renderFrame = async () => {
      if (frameCount >= totalFrames) {
        recorder.stop()
        // Wait for final ondataavailable event after stop()
        await new Promise(r => setTimeout(r, 100))
        resolve()
        return
      }

      // 영상 시간 설정 (균등 분배)
      const targetTime = videoStartSec + (frameCount / FPS)
      await seekVideo(targetTime)

      // 배경색
      ctx.fillStyle = '#050508'
      ctx.fillRect(0, 0, W, H)

      // 영상 배경 (상단 50%만, center-crop + transform)
      ctx.save()
      ctx.globalAlpha = bgOpacity
      ctx.translate(bgX, bgY)
      ctx.scale(bgScale, bgScale)

      const videoHeight = H / 2 // 상단 50%만
      const vw = video.videoWidth || W
      const vh = video.videoHeight || H
      const targetRatio = W / videoHeight
      const srcRatio = vw / vh
      let sx = 0, sy = 0, sw = vw, sh = vh
      if (srcRatio > targetRatio) { sw = vh * targetRatio; sx = (vw - sw) / 2 }
      else { sh = vw / targetRatio; sy = (vh - sh) / 2 }
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W / bgScale, videoHeight / bgScale)
      
      // 영상 하단 그라데이션 페이드
      const gradient = ctx.createLinearGradient(0, videoHeight * 0.4, 0, videoHeight)
      gradient.addColorStop(0, 'rgba(5,5,8,0)')
      gradient.addColorStop(0.55, 'rgba(5,5,8,0.55)')
      gradient.addColorStop(1, 'rgba(5,5,8,1)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, W / bgScale, videoHeight / bgScale)
      
      ctx.restore()

      // 오버레이 (영상 카드뉴스에서는 자체 그라데이션 사용, 표준 오버레이 생략)
      // isVideoBackground always true here, so skip standard overlay

      // 텍스트 레이어
      for (const layer of textLayers) {
        drawTextLayer(ctx, layer)
      }

      frameCount++
      requestAnimationFrame(() => { renderFrame().catch(reject) })
    }

    renderFrame().catch(err => { recorder.stop(); reject(err) })
  })

  URL.revokeObjectURL(sourceObjectUrl)
  
  if (chunks.length === 0) {
    throw new Error('영상 녹화에 실패했습니다. 브라우저가 이 코덱을 지원하지 않을 수 있습니다.')
  }
  
  return new Blob(chunks, { type: mimeType })
}
