'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { ChevronDown, Film, PlaySquare } from 'lucide-react'

interface Props {
  prefix: string
  label: string
}

const SOLUTIONS = [
  {
    icon: Film,
    ko: '영상 카드뉴스',
    en: 'Video Card News',
    desc: 'AI가 주제에서 영상 카드뉴스를 자동 제작',
    descEn: 'AI-powered video card news from any topic',
    href: '/solutions/video-card-news',
    accent: '#ed6238',
  },
  {
    icon: PlaySquare,
    ko: '유튜브 자동화',
    en: 'YouTube Automation',
    desc: '숏폼 유튜브 영상을 자동으로 매일 제작',
    descEn: 'Daily short-form YouTube videos, automated',
    href: '/solutions/youtube-automation',
    accent: '#ff0000',
  },
]

export function ProductNavDropdown({ prefix, label }: Props) {
  const [open, setOpen] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isEn = prefix === '/en'

  const show = () => {
    clearTimeout(timeoutRef.current)
    setOpen(true)
  }
  const hide = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 120)
  }

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      <button
        className="flex items-center gap-1 transition-opacity hover:opacity-70"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {label}
        <ChevronDown
          className="h-3.5 w-3.5 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {open && (
        <div
          className="absolute left-1/2 top-full z-50 mt-3 w-72 -translate-x-1/2 overflow-hidden rounded-2xl border border-[#e8e2d8] bg-white shadow-xl shadow-black/8"
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          {/* Arrow */}
          <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-l border-t border-[#e8e2d8] bg-white" />

          <div className="relative p-2">
            {SOLUTIONS.map(({ icon: Icon, ko, en, desc, descEn, href, accent }) => (
              <Link
                key={href}
                href={`${prefix}${href}`}
                className="group flex items-start gap-3.5 rounded-xl px-3.5 py-3 transition-colors hover:bg-[#f9f6f2]"
              >
                <div
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `${accent}18` }}
                >
                  <Icon className="h-4 w-4" style={{ color: accent }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#171714]">{isEn ? en : ko}</p>
                  <p className="mt-0.5 text-xs leading-5 text-[#857e73]">{isEn ? descEn : desc}</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="border-t border-[#f0ece6] bg-[#faf8f5] px-5 py-2.5">
            <p className="text-[11px] text-[#a09890]">
              {isEn ? 'Explore Shuffla solutions →' : 'Shuffla 솔루션 전체 보기 →'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
