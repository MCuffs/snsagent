'use client'

import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import * as THREE from 'three'

type StoryboardSlide = {
  slideNumber: number
  role: string
  headline: string
  body: string
}

type StoryboardStage3DProps = {
  slides: StoryboardSlide[]
  swatches: string[]
  selectedSlideNumber: number
  onSelect: (slideNumber: number) => void
  locale: string
}

function colorAt(swatches: string[], index: number, fallback: string) {
  return swatches[index % Math.max(swatches.length, 1)] || fallback
}

function clampIndex(index: number, max: number) {
  return Math.min(Math.max(index, 0), Math.max(max, 0))
}

function WebGLDepthField({ color }: { color: string }) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100)
    camera.position.z = 8
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6))
    renderer.setClearColor(0x000000, 0)
    host.appendChild(renderer.domElement)

    const parsedColor = new THREE.Color(color)
    const pointGeometry = new THREE.BufferGeometry()
    const positions = new Float32Array(260 * 3)
    for (let index = 0; index < positions.length; index += 3) {
      positions[index] = (Math.random() - 0.5) * 16
      positions[index + 1] = (Math.random() - 0.5) * 10
      positions[index + 2] = -Math.random() * 10
    }
    pointGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const pointMaterial = new THREE.PointsMaterial({ color: parsedColor, size: 0.035, transparent: true, opacity: 0.55 })
    const particles = new THREE.Points(pointGeometry, pointMaterial)
    scene.add(particles)

    const ringGeometry = new THREE.TorusGeometry(2.8, 0.012, 8, 160)
    const ringMaterial = new THREE.MeshBasicMaterial({ color: parsedColor, transparent: true, opacity: 0.2 })
    const rings = [-2.2, 0, 2.2].map((x, index) => {
      const ring = new THREE.Mesh(ringGeometry, ringMaterial)
      ring.position.set(x, index === 1 ? 0.3 : -0.7, -2.5 - index)
      ring.rotation.x = 1.08
      ring.rotation.y = index * 0.35
      scene.add(ring)
      return ring
    })

    let pointerX = 0
    let pointerY = 0
    let frame = 0
    const onPointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect()
      pointerX = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointerY = ((event.clientY - rect.top) / rect.height) * 2 - 1
    }
    host.parentElement?.addEventListener('pointermove', onPointerMove)

    const resize = () => {
      const width = Math.max(host.clientWidth, 1)
      const height = Math.max(host.clientHeight, 1)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()

    const animate = (time: number) => {
      particles.rotation.y = time * 0.000025 + pointerX * 0.035
      particles.rotation.x += ((pointerY * 0.025) - particles.rotation.x) * 0.03
      rings.forEach((ring, index) => {
        ring.rotation.z = time * 0.00006 * (index % 2 ? -1 : 1)
        ring.position.y += ((Math.sin(time * 0.0005 + index) * 0.18) - ring.position.y) * 0.015
      })
      renderer.render(scene, camera)
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      host.parentElement?.removeEventListener('pointermove', onPointerMove)
      pointGeometry.dispose()
      pointMaterial.dispose()
      ringGeometry.dispose()
      ringMaterial.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [color])

  return <div ref={hostRef} className="pointer-events-none absolute inset-0" aria-hidden="true" />
}

export default function StoryboardStage3D({ slides, swatches, selectedSlideNumber, onSelect, locale }: StoryboardStage3DProps) {
  const isEn = locale === 'en'
  const selectedIndex = clampIndex(slides.findIndex(slide => slide.slideNumber === selectedSlideNumber), slides.length - 1)
  const canGoPrevious = selectedIndex > 0
  const canGoNext = selectedIndex < slides.length - 1

  const move = (direction: -1 | 1) => {
    const nextSlide = slides[selectedIndex + direction]
    if (nextSlide) onSelect(nextSlide.slideNumber)
  }

  return (
    <section className="relative h-[580px] w-full overflow-hidden bg-[#070a11] sm:h-[720px]" aria-label={isEn ? '3D storyboard stage' : '3D 스토리보드 스테이지'}>
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_50%_38%,rgba(58,75,116,0.42),transparent_34%),linear-gradient(145deg,#070a11_0%,#101725_55%,#090d16_100%)]" />
      <WebGLDepthField color={swatches[1] ?? '#60a5fa'} />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between p-5 text-white sm:p-8">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">Live storyboard</p>
          <p className="mt-1 text-sm font-black sm:text-base">{isEn ? 'One card. One decisive beat.' : '한 장씩, 이야기의 리듬을 확인하세요'}</p>
        </div>
        <span className="rounded-full border border-white/14 bg-black/20 px-3 py-1.5 text-[10px] font-black text-white/72 backdrop-blur-md">
          {String(selectedIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
        </span>
      </div>

      <div className="absolute inset-0 [perspective:1800px] [transform-style:preserve-3d]">
        {slides.map((slide, index) => {
          const distance = index - selectedIndex
          const isSelected = distance === 0
          const isNeighbor = Math.abs(distance) === 1
          const primary = colorAt(swatches, index, '#2563eb')
          const secondary = colorAt(swatches, index + 1, '#111827')
          const transform = isSelected
            ? 'translate(-50%, -48%) translateZ(180px) rotateX(3deg) scale(1.04)'
            : `translate(-50%, -48%) translateX(${distance * 410}px) translateZ(-180px) rotateY(${-distance * 48}deg) scale(0.67)`

          return (
            <button
              key={`${slide.slideNumber}-${slide.headline}`}
              type="button"
              onClick={() => onSelect(slide.slideNumber)}
              className={`group absolute left-1/2 top-1/2 aspect-[4/5] w-[300px] rounded-[26px] border text-left transition-all duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-[440px] ${
                isSelected
                  ? 'z-30 border-white/60 opacity-100 shadow-[0_60px_140px_rgba(0,0,0,0.62)]'
                  : isNeighbor
                    ? 'z-10 border-white/10 opacity-30 hover:opacity-55'
                    : 'pointer-events-none opacity-0'
              }`}
              style={{ transform }}
              aria-pressed={isSelected}
              aria-label={isEn ? `Select card ${slide.slideNumber}` : `${slide.slideNumber}번 카드 선택`}
            >
              <span className="absolute -inset-2 rounded-[32px] bg-white/8 blur-xl" />
              <span className="relative flex h-full flex-col overflow-hidden rounded-[24px] text-white" style={{ background: `linear-gradient(148deg, ${primary}, ${secondary} 62%, #070a11)` }}>
                <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,rgba(255,255,255,0.34)_0%,rgba(255,255,255,0.06)_27%,transparent_52%)]" />
                <span className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/14 blur-3xl" />
                <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-18deg] bg-white/12 blur-xl transition-transform duration-[1400ms] group-hover:translate-x-[520%]" />
                <span className="relative flex h-full flex-col justify-between p-6 sm:p-9">
                  <span className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-white/68 sm:text-xs">
                    <span>{slide.role}</span>
                    <span>{String(slide.slideNumber).padStart(2, '0')}</span>
                  </span>
                  <span>
                    <span className="block text-[30px] font-black leading-[1.08] sm:text-[46px]">{slide.headline}</span>
                    <span className="mt-5 block line-clamp-5 text-sm font-semibold leading-6 text-white/76 sm:mt-7 sm:text-base sm:leading-7">{slide.body}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {swatches.slice(0, 4).map((color, swatchIndex) => <span key={`${color}-${swatchIndex}`} className="h-1.5 flex-1 rounded-full" style={{ background: color }} />)}
                  </span>
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="absolute inset-y-0 left-3 z-40 flex items-center sm:left-8">
        <button type="button" onClick={() => move(-1)} disabled={!canGoPrevious} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/14 bg-black/30 text-white backdrop-blur-md transition hover:scale-105 hover:bg-black/50 disabled:opacity-20" aria-label={isEn ? 'Previous card' : '이전 카드'}><ChevronLeft className="h-5 w-5" /></button>
      </div>
      <div className="absolute inset-y-0 right-3 z-40 flex items-center sm:right-8">
        <button type="button" onClick={() => move(1)} disabled={!canGoNext} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/14 bg-black/30 text-white backdrop-blur-md transition hover:scale-105 hover:bg-black/50 disabled:opacity-20" aria-label={isEn ? 'Next card' : '다음 카드'}><ChevronRight className="h-5 w-5" /></button>
      </div>

      <div className="absolute inset-x-0 bottom-5 z-40 flex justify-center gap-1.5 sm:bottom-7">
        {slides.map(slide => (
          <button key={slide.slideNumber} type="button" onClick={() => onSelect(slide.slideNumber)} className={`h-1.5 rounded-full transition-all duration-500 ${slide.slideNumber === selectedSlideNumber ? 'w-8 bg-white' : 'w-1.5 bg-white/24 hover:bg-white/50'}`} aria-label={isEn ? `Go to card ${slide.slideNumber}` : `${slide.slideNumber}번 카드로 이동`} />
        ))}
      </div>
    </section>
  )
}
