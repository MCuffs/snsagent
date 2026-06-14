'use client'

import { useMemo, useRef } from 'react'
import { motion, useScroll, useTransform, useInView } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

// 전체 카드 풀 — 랜딩마다 셔플해서 3열에 배분
const ALL_CARDS = [
  '/front/card-01.png',
  '/front/card-02.png',
  '/front/card-03.png',
  '/front/card-04.png',
  '/front/card-05.png',
  '/front/card-06.png',
  '/front/card-07.png',
  '/front/card-08.png',
  '/front/card-09.png',
  '/front/card-10.png',
  '/front/card-11.png',
  '/front/card-12.png',
  '/front/card-13.png',
  '/front/card-14.png',
  '/front/card-15.png',
  '/front/card-16.png',
  '/front/card-17.png',
  '/front/card-kakao-01.png',
  '/front/card-kakao-02.png',
  '/front/card-kakao-03.png',
  '/front/card-kakao-04.png',
  '/front/card-kakao-05.png',
  '/front/card-kakao-06.png',
  '/front/card-kakao-07.png',
  '/front/card-kakao-08.png',
  '/front/card-kakao-09.png',
  '/front/card-kakao-10.png',
  '/front/card-kakao-11.png',
  '/front/card-kakao-12.png',
  '/front/card-hu100-01.png',
  '/front/card-hu100-02.png',
  '/front/card-hu100-03.png',
  '/front/card-hu100-04.png',
]

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 페이지 배경색 — 갤러리 상하단 페이드와 통일
const BG = '#ffffff'

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
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  })

  // 랜딩마다 셔플 후 3열로 균등 배분
  const [colA, colB, colC] = useMemo(() => {
    const shuffled = shuffleArray(ALL_CARDS)
    const perCol = Math.ceil(shuffled.length / 3)
    return [
      shuffled.slice(0, perCol),
      shuffled.slice(perCol, perCol * 2),
      shuffled.slice(perCol * 2),
    ]
  }, [])

  // 패럴렉스 폭을 줄여 상단 이탈 방지 (-6% / +5% / -8%)
  const yA = useTransform(scrollYProgress, [0, 1], ['0%', '-6%'])
  const yB = useTransform(scrollYProgress, [0, 1], ['0%', '5%'])
  const yC = useTransform(scrollYProgress, [0, 1], ['0%', '-8%'])

  return (
    <section
      ref={containerRef}
      className="relative overflow-hidden"
      style={{ background: BG }}
    >
      {/* 은은하게 퍼지고 움직이는 그라데이션 백그라운드 효과 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Glow 1: Sky Blue */}
        <div className="bg-glow-1 absolute -top-[15%] left-[5%] h-[550px] w-[550px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.07)_0%,transparent_70%)] blur-3xl" />
        {/* Glow 2: Light Blue */}
        <div className="bg-glow-2 absolute top-[10%] -right-[10%] h-[650px] w-[650px] rounded-full bg-[radial-gradient(circle,rgba(14,165,233,0.07)_0%,transparent_70%)] blur-3xl" />
      </div>

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
      {/* overflow-hidden으로 패럴렉스 이탈 차단 */}
      <div className="relative z-10 mt-16 overflow-hidden px-4 pb-0">
        {/* 상단 페이드 — 텍스트 영역에서 갤러리로 부드럽게 연결 */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-48"
          style={{ background: `linear-gradient(to bottom, ${BG} 10%, transparent)` }}
        />
        {/* 하단 페이드 — 다음 섹션으로 자연스럽게 연결 */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-64"
          style={{ background: `linear-gradient(to top, ${BG} 30%, transparent)` }}
        />

        <div className="mx-auto grid max-w-[1300px] grid-cols-3 gap-3 md:gap-4">
          {/* 열 A */}
          <motion.div style={{ y: yA }} className="flex flex-col gap-3 md:gap-4">
            {colA.map((src, i) => (
              <CardItem key={src} src={src} index={i} direction="left" />
            ))}
          </motion.div>

          {/* 열 B — 약간 아래에서 시작해 엇갈림 효과 */}
          <motion.div style={{ y: yB }} className="flex flex-col gap-3 pt-10 md:gap-4 md:pt-14">
            {colB.map((src, i) => (
              <CardItem key={src} src={src} index={i} direction="up" />
            ))}
          </motion.div>

          {/* 열 C */}
          <motion.div style={{ y: yC }} className="flex flex-col gap-3 md:gap-4">
            {colC.map((src, i) => (
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
  const inView = useInView(ref, { once: true, margin: '0px 0px -40px 0px' })

  const initial =
    direction === 'left'
      ? { opacity: 0, x: -36, scale: 0.93 }
      : direction === 'right'
      ? { opacity: 0, x: 36, scale: 0.93 }
      : { opacity: 0, y: 36, scale: 0.93 }

  return (
    <motion.div
      ref={ref}
      initial={initial}
      animate={inView ? { opacity: 1, x: 0, y: 0, scale: 1 } : initial}
      transition={{
        duration: 0.65,
        delay: index * 0.06,
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
