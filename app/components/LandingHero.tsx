'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform, useInView } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

// 17장의 카드뉴스 이미지
const CARDS = Array.from({ length: 17 }, (_, i) => `/front/card-${String(i + 1).padStart(2, '0')}.png`)

// 3열 그리드 배분
const COL_A = [CARDS[0], CARDS[3], CARDS[6], CARDS[9],  CARDS[12], CARDS[15]]
const COL_B = [CARDS[1], CARDS[4], CARDS[7], CARDS[10], CARDS[13], CARDS[16]]
const COL_C = [CARDS[2], CARDS[5], CARDS[8], CARDS[11], CARDS[14]]

// 페이지 배경색 — 갤러리 상하단 페이드와 통일
const BG = '#fbfaf7'

interface Props {
  authenticated: boolean
  accessHref: string
  locale: string
  headline: string
  sub: string
  ctaStart: string
  ctaContinue: string
  ctaFreeHint: string
  badgeText: string
}

export function LandingHero({
  authenticated,
  accessHref,
  headline,
  sub,
  ctaStart,
  ctaContinue,
  ctaFreeHint,
  badgeText,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end start'] })

  // 열마다 다른 방향으로 스크롤 패럴렉스
  const yA = useTransform(scrollYProgress, [0, 1], ['0%', '-12%'])
  const yB = useTransform(scrollYProgress, [0, 1], ['0%', '8%'])
  const yC = useTransform(scrollYProgress, [0, 1], ['0%', '-18%'])

  return (
    <section
      ref={containerRef}
      className="relative overflow-hidden"
      style={{ background: BG }}
    >
      {/* 은은한 중앙 글로우 */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_30%,rgba(237,98,56,0.05),transparent)]" />

      {/* ── 히어로 텍스트 ─────────────────────────────── */}
      <div className="relative z-10 mx-auto max-w-5xl px-5 pt-28 text-center md:pt-36">
        {/* 뱃지 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 rounded-full border border-[#e8e2d8] bg-white/80 px-4 py-1.5 text-xs font-medium text-[#716a60]"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#ed6238]" />
          {badgeText}
        </motion.div>

        {/* 헤드라인 */}
        <motion.h1
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mt-7 whitespace-pre-line text-[clamp(3rem,9vw,7.5rem)] font-bold leading-[0.92] tracking-[-0.06em] text-[#171714]"
        >
          {headline}
        </motion.h1>

        {/* 서브카피 */}
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-6 max-w-xl whitespace-pre-line text-[15px] leading-8 text-[#746e65] md:text-base"
        >
          {sub}
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.34, ease: [0.16, 1, 0.3, 1] }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            href={accessHref}
            className="group inline-flex h-12 items-center gap-2 rounded-full bg-[#171714] px-7 text-sm font-semibold text-white transition-all hover:-translate-y-px hover:bg-[#302c26]"
          >
            {authenticated ? ctaContinue : ctaStart}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </motion.div>

        {!authenticated && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.46 }}
            className="mt-3 text-xs text-[#a89e94]"
          >
            {ctaFreeHint}
          </motion.p>
        )}
      </div>

      {/* ── 카드 갤러리 그리드 ────────────────────────── */}
      <div className="relative z-10 mt-16 px-4 pb-0">
        {/* 상단 페이드 — 텍스트 영역에서 갤러리로 부드럽게 연결 */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-40"
          style={{ background: `linear-gradient(to bottom, ${BG}, transparent)` }}
        />
        {/* 하단 페이드 — 다음 섹션으로 자연스럽게 연결 */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-56"
          style={{ background: `linear-gradient(to top, ${BG} 20%, transparent)` }}
        />

        <div className="mx-auto grid max-w-[1300px] grid-cols-3 gap-3 md:gap-4">
          {/* 열 A */}
          <motion.div style={{ y: yA }} className="flex flex-col gap-3 md:gap-4">
            {COL_A.map((src, i) => (
              <CardItem key={src} src={src} index={i} direction="left" />
            ))}
          </motion.div>

          {/* 열 B — 약간 아래로 시작해서 엇갈림 효과 */}
          <motion.div style={{ y: yB }} className="flex flex-col gap-3 pt-8 md:gap-4 md:pt-12">
            {COL_B.map((src, i) => (
              <CardItem key={src} src={src} index={i} direction="up" />
            ))}
          </motion.div>

          {/* 열 C */}
          <motion.div style={{ y: yC }} className="flex flex-col gap-3 md:gap-4">
            {COL_C.map((src, i) => (
              <CardItem key={src} src={src} index={i} direction="right" />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function CardItem({ src, index, direction }: { src: string; index: number; direction: 'left' | 'right' | 'up' }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -60px 0px' })

  const initial =
    direction === 'left'
      ? { opacity: 0, x: -40, scale: 0.92 }
      : direction === 'right'
      ? { opacity: 0, x: 40, scale: 0.92 }
      : { opacity: 0, y: 40, scale: 0.92 }

  return (
    <motion.div
      ref={ref}
      initial={initial}
      animate={inView ? { opacity: 1, x: 0, y: 0, scale: 1 } : initial}
      transition={{
        duration: 0.7,
        delay: index * 0.07,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="overflow-hidden rounded-xl shadow-sm"
    >
      <Image
        src={src}
        alt=""
        width={420}
        height={525}
        className="w-full object-cover"
        sizes="(max-width: 768px) 33vw, 420px"
        priority={index < 2}
      />
    </motion.div>
  )
}
