'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Loader2, Award, FileText, Zap, TrendingUp, Star, ChevronRight } from 'lucide-react'
import { getPainterStatusAction } from '../../actions/painter'

interface Brand {
  id: string
  name: string
  industry: string
  targetAudience: string
  toneOfVoice: string
  mainColor: string
  forbiddenWords: string
  ctaStyle: string
  brandDna?: string | null
  websiteUrl?: string | null
}

interface PainterDashboardProps {
  brand: Brand
}

interface PainterStatus {
  campaignCount: number
  editLogCount: number
  preference: {
    summary: string | null
    preferredHookPatterns: string | null
    preferredLayouts: string | null
    avoidPatterns: string | null
    preferredCopyTone: string | null
  } | null
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }
  }
}

interface LevelInfo {
  level: number
  title: string
  subtitle: string
  xpRequired: number
  color: string
  glowColor: string
  bgGradient: string
  nextLevelBonus: string
  skills: string[]
}

const LEVELS: LevelInfo[] = [
  {
    level: 1,
    title: '신진 아티스트',
    subtitle: 'Emerging Artist',
    xpRequired: 30,
    color: '#3b82f6',
    glowColor: 'rgba(59,130,246,0.3)',
    bgGradient: 'from-blue-50 to-indigo-50',
    nextLevelBonus: '레이아웃 패턴 학습 시작 → 구도가 더 정교해집니다',
    skills: ['기본 카피 톤 파악', '컬러 선호도 수집'],
  },
  {
    level: 2,
    title: '기성 아티스트',
    subtitle: 'Established Artist',
    xpRequired: 80,
    color: '#8b5cf6',
    glowColor: 'rgba(139,92,246,0.3)',
    bgGradient: 'from-violet-50 to-purple-50',
    nextLevelBonus: '훅 패턴 정밀화 → 첫 슬라이드 반응률이 높아집니다',
    skills: ['레이아웃 선호도 분석', '톤앤매너 고도화', '구도 자동 보정'],
  },
  {
    level: 3,
    title: '전문 아티스트',
    subtitle: 'Professional Artist',
    xpRequired: 180,
    color: '#ec4899',
    glowColor: 'rgba(236,72,153,0.3)',
    bgGradient: 'from-pink-50 to-rose-50',
    nextLevelBonus: '브랜드 DNA 완전 내재화 → 생성마다 브랜드 핏이 최대화됩니다',
    skills: ['정밀 편집 피드백 반영', '감성 곡선 학습', '브랜드 컬러 정합성', '카피 서사 흐름 최적화'],
  },
  {
    level: 4,
    title: '마스터 크리에이터',
    subtitle: 'Master Creator',
    xpRequired: 999999,
    color: '#eab308',
    glowColor: 'rgba(234,179,8,0.35)',
    bgGradient: 'from-yellow-50 to-amber-50',
    nextLevelBonus: '최고 레벨 달성',
    skills: ['완전한 시각적 일관성', '예측 기반 레이아웃 제안', '브랜드 고유 서사 자동 생성', '에디터 수정 제로 지향'],
  },
]

// SVG character for each level
function PainterCharacter({ level, color }: { level: number; color: string }) {
  if (level === 1) {
    // Curious student with small brush and sketchbook
    return (
      <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Body */}
        <ellipse cx="40" cy="52" rx="14" ry="16" fill={color} opacity="0.15" />
        <ellipse cx="40" cy="52" rx="12" ry="14" fill={color} opacity="0.25" />
        {/* Head */}
        <circle cx="40" cy="28" r="13" fill={color} opacity="0.9" />
        <circle cx="40" cy="28" r="11" fill="white" opacity="0.9" />
        {/* Eyes */}
        <circle cx="35.5" cy="26" r="2.5" fill={color} />
        <circle cx="44.5" cy="26" r="2.5" fill={color} />
        {/* Smile - curious */}
        <path d="M35 32 Q40 36 45 32" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        {/* Small brush */}
        <rect x="51" y="30" width="3" height="18" rx="1.5" fill={color} opacity="0.7" />
        <ellipse cx="52.5" cy="30" rx="2.5" ry="4" fill={color} />
        {/* Sketchbook */}
        <rect x="20" y="42" width="14" height="18" rx="2" fill="white" stroke={color} strokeWidth="1.5" opacity="0.9" />
        <line x1="23" y1="47" x2="31" y2="47" stroke={color} strokeWidth="1" opacity="0.5" />
        <line x1="23" y1="51" x2="31" y2="51" stroke={color} strokeWidth="1" opacity="0.5" />
        <line x1="23" y1="55" x2="28" y2="55" stroke={color} strokeWidth="1" opacity="0.5" />
        {/* Star above head */}
        <path d="M40 10 L41.5 14 L46 14 L42.5 16.5 L44 21 L40 18.5 L36 21 L37.5 16.5 L34 14 L38.5 14 Z" fill={color} opacity="0.6" />
      </svg>
    )
  }

  if (level === 2) {
    // Confident artist with palette and larger brush
    return (
      <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Beret */}
        <ellipse cx="40" cy="17" rx="16" ry="7" fill={color} opacity="0.85" />
        <circle cx="48" cy="15" r="3" fill={color} />
        {/* Head */}
        <circle cx="40" cy="28" r="12" fill="white" />
        <circle cx="40" cy="28" r="12" fill={color} opacity="0.1" />
        {/* Eyes - confident */}
        <path d="M34 26 Q35.5 24 37 26" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M43 26 Q44.5 24 46 26" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* Smile */}
        <path d="M35 31 Q40 35.5 45 31" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        {/* Body */}
        <rect x="28" y="40" width="24" height="20" rx="5" fill={color} opacity="0.2" />
        {/* Palette */}
        <ellipse cx="24" cy="52" rx="8" ry="6" fill="white" stroke={color} strokeWidth="1.5" />
        <circle cx="21" cy="50" r="2" fill={color} opacity="0.8" />
        <circle cx="25" cy="48" r="2" fill="#ec4899" opacity="0.8" />
        <circle cx="28" cy="51" r="2" fill="#3b82f6" opacity="0.8" />
        <circle cx="24" cy="54" r="1.5" fill="#eab308" opacity="0.8" />
        {/* Brush */}
        <rect x="53" y="26" width="3.5" height="22" rx="1.75" fill={color} opacity="0.8" />
        <ellipse cx="54.75" cy="26" rx="3" ry="5" fill={color} />
        {/* Sparkles */}
        <circle cx="62" cy="18" r="1.5" fill={color} opacity="0.5" />
        <circle cx="58" cy="13" r="1" fill={color} opacity="0.4" />
        <circle cx="65" cy="13" r="1" fill={color} opacity="0.3" />
      </svg>
    )
  }

  if (level === 3) {
    // Professional with canvas and flowing coat
    return (
      <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Hat */}
        <rect x="27" y="10" width="26" height="10" rx="3" fill={color} opacity="0.9" />
        <rect x="24" y="17" width="32" height="4" rx="2" fill={color} />
        {/* Head */}
        <circle cx="40" cy="30" r="12" fill="white" />
        <circle cx="40" cy="30" r="12" fill={color} opacity="0.08" />
        {/* Eyes - sharp/professional */}
        <rect x="33.5" y="27" width="5" height="3" rx="1.5" fill={color} />
        <rect x="41.5" y="27" width="5" height="3" rx="1.5" fill={color} />
        {/* Confident smirk */}
        <path d="M36 34 Q40 37.5 44.5 33.5" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* Long coat/body */}
        <rect x="26" y="42" width="28" height="24" rx="6" fill={color} opacity="0.18" />
        <line x1="40" y1="42" x2="40" y2="66" stroke={color} strokeWidth="1" opacity="0.3" />
        {/* Canvas on easel */}
        <rect x="8" y="35" width="16" height="20" rx="2" fill="white" stroke={color} strokeWidth="1.5" />
        <line x1="8" y1="55" x2="12" y2="62" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        <line x1="24" y1="55" x2="20" y2="62" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        {/* Abstract painting on canvas */}
        <circle cx="14" cy="42" r="4" fill={color} opacity="0.4" />
        <ellipse cx="18" cy="47" rx="3" ry="4" fill={color} opacity="0.25" />
        {/* Long brush */}
        <rect x="55" y="22" width="4" height="28" rx="2" fill={color} opacity="0.85" />
        <ellipse cx="57" cy="22" rx="3.5" ry="6" fill={color} />
        {/* Award badge */}
        <circle cx="64" cy="46" r="6" fill={color} opacity="0.15" stroke={color} strokeWidth="1.5" />
        <path d="M64 43 L65 45.5 L68 45.5 L65.8 47.2 L66.7 50 L64 48.4 L61.3 50 L62.2 47.2 L60 45.5 L63 45.5 Z" fill={color} opacity="0.8" />
      </svg>
    )
  }

  // level 4: Master — grand maestro
  return (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Crown */}
      <path d="M26 16 L30 8 L36 14 L40 6 L44 14 L50 8 L54 16 Z" fill={color} opacity="0.9" />
      <rect x="26" y="14" width="28" height="6" rx="2" fill={color} />
      {/* Gems in crown */}
      <circle cx="33" cy="15" r="2" fill="white" opacity="0.8" />
      <circle cx="40" cy="13" r="2.5" fill="white" opacity="0.9" />
      <circle cx="47" cy="15" r="2" fill="white" opacity="0.8" />
      {/* Head with golden glow */}
      <circle cx="40" cy="32" r="13" fill={color} opacity="0.15" />
      <circle cx="40" cy="32" r="11" fill="white" />
      {/* Eyes - wise & powerful */}
      <path d="M33 29 Q35 27 37 29 Q35 31 33 29Z" fill={color} />
      <path d="M43 29 Q45 27 47 29 Q45 31 43 29Z" fill={color} />
      {/* Grand smile */}
      <path d="M34 35.5 Q40 40 46 35.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      {/* Cape / royal body */}
      <path d="M24 44 Q20 52 22 66 L40 64 L58 66 Q60 52 56 44 Z" fill={color} opacity="0.2" />
      <path d="M24 44 Q32 48 40 46 Q48 48 56 44" stroke={color} strokeWidth="1.5" fill="none" opacity="0.5" />
      {/* Ornate brush - golden */}
      <rect x="57" y="20" width="5" height="30" rx="2.5" fill={color} opacity="0.9" />
      <ellipse cx="59.5" cy="20" rx="4" ry="7" fill={color} />
      <rect x="57" y="44" width="5" height="4" rx="1" fill={color} opacity="0.5" />
      {/* Scattered stars */}
      {[
        [10, 18], [14, 10], [7, 28], [65, 12], [70, 22], [68, 32],
      ].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y} L${x+1.2} ${y+3} L${x+4} ${y+3} L${x+1.8} ${y+4.8} L${x+2.8} ${y+8} L${x} ${y+6} L${x-2.8} ${y+8} L${x-1.8} ${y+4.8} L${x-4} ${y+3} L${x-1.2} ${y+3} Z`}
          fill={color} opacity={0.3 + i * 0.08} />
      ))}
    </svg>
  )
}

export default function PainterDashboard({ brand }: PainterDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<PainterStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await getPainterStatusAction(brand.id)
        if (res.success) {
          setStatus({
            campaignCount: res.campaignCount,
            editLogCount: res.editLogCount,
            preference: res.preference,
          })
        } else {
          setError(res.error || 'Failed to load status')
        }
      } catch {
        setError('Failed to load painter status')
      } finally {
        setLoading(false)
      }
    }
    void loadStatus()
  }, [brand.id])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#fafafa]">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#0066ff]" />
          <p className="mt-3 text-sm text-[#71717a] font-medium">화가의 서재를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error || !status) {
    return (
      <div className="flex h-full items-center justify-center bg-[#fafafa] p-6">
        <div className="text-center max-w-sm">
          <p className="text-sm font-semibold text-red-600">{error || '데이터 로드 실패'}</p>
          <p className="text-xs text-[#71717a] mt-2">브랜드 설정이나 네트워크 연결을 확인해주세요.</p>
        </div>
      </div>
    )
  }

  // XP calculation
  const campaignXp = status.campaignCount * 10
  const editXp = status.editLogCount * 3
  const totalXp = campaignXp + editXp

  // Level calculation
  let currentLevelIdx = 0
  let xpIntoLevel = totalXp
  let xpForCurrentSpan = LEVELS[0].xpRequired
  let progressPercent = 0

  for (let i = 0; i < LEVELS.length - 1; i++) {
    if (totalXp >= LEVELS[i].xpRequired) {
      currentLevelIdx = i + 1
      const prevRequired = LEVELS[i].xpRequired
      const nextRequired = LEVELS[i + 1].xpRequired
      xpIntoLevel = totalXp - prevRequired
      xpForCurrentSpan = nextRequired - prevRequired
      progressPercent = Math.min((xpIntoLevel / xpForCurrentSpan) * 100, 100)
    } else {
      if (i === 0) {
        xpIntoLevel = totalXp
        xpForCurrentSpan = LEVELS[0].xpRequired
        progressPercent = Math.min((totalXp / xpForCurrentSpan) * 100, 100)
      }
      break
    }
  }
  if (currentLevelIdx === LEVELS.length - 1) {
    progressPercent = 100
  }

  const currentLevel = LEVELS[currentLevelIdx]
  const isMaxLevel = currentLevelIdx === LEVELS.length - 1
  const xpToNext = isMaxLevel ? 0 : xpForCurrentSpan - xpIntoLevel

  const hasPref = !!(status.preference?.summary)
  const prefSummary = hasPref
    ? status.preference!.summary!
    : `아직 충분한 편집 기록이 수집되지 않았습니다. 카드뉴스를 생성하고 에디터에서 배경, 텍스트, 컬러를 수정할수록 화가가 더 빠르게 당신의 스타일을 학습합니다.`

  return (
    <div className="flex h-full overflow-y-auto bg-[#fafafa]">
      <div className="flex-1">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-3xl px-6 py-10"
        >

          {/* ── Hero: Value proposition banner ── */}
          <motion.div
            variants={itemVariants}
            className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-[#111111] to-[#1e1e2e] p-6 shadow-lg"
          >
            <div className="flex items-start gap-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
                <span className="text-2xl">🎨</span>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">My Painter</p>
                <h1 className="text-lg font-black text-white leading-snug">
                  생성할수록 나를 이해하는<br />
                  <span style={{ color: currentLevel.color }}>나만의 AI 아티스트</span>
                </h1>
                <p className="mt-2 text-xs text-white/60 leading-relaxed font-medium">
                  카드뉴스를 만들고 편집할수록 화가가 당신의 시각적 취향·브랜드 톤을 학습합니다.<br />
                  레벨이 오를수록 생성 결과물이 브랜드에 더 정확히 맞아집니다.
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── Main: Character + Level ── */}
          <div className="grid gap-5 md:grid-cols-3 mb-5">
            {/* Character Card */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col items-center justify-center rounded-2xl border border-[#e4e4e7] bg-white p-6 shadow-sm"
            >
              {/* Character */}
              <div
                className="relative flex h-28 w-28 items-center justify-center rounded-2xl mb-4"
                style={{
                  background: `radial-gradient(circle at 50% 40%, ${currentLevel.glowColor}, transparent 70%)`,
                  boxShadow: `0 0 32px ${currentLevel.glowColor}`,
                }}
              >
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="h-24 w-24"
                >
                  <PainterCharacter level={currentLevel.level} color={currentLevel.color} />
                </motion.div>
                {/* Level badge */}
                <div
                  className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[11px] font-black text-white shadow-md"
                  style={{ backgroundColor: currentLevel.color }}
                >
                  {currentLevel.level}
                </div>
              </div>

              <h3 className="text-sm font-black text-[#111111] text-center">{currentLevel.title}</h3>
              <p className="text-[10px] font-semibold text-[#71717a] text-center mt-0.5">{currentLevel.subtitle}</p>

              {/* All levels mini-track */}
              <div className="mt-4 flex items-center gap-1.5 w-full justify-center">
                {LEVELS.map((lvl, i) => (
                  <div
                    key={lvl.level}
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black transition-all ${
                      i <= currentLevelIdx
                        ? 'text-white shadow-sm'
                        : 'bg-[#f4f4f5] text-[#a1a1aa]'
                    }`}
                    style={i <= currentLevelIdx ? { backgroundColor: lvl.color } : {}}
                  >
                    {lvl.level}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Progress + Stats */}
            <motion.div
              variants={itemVariants}
              className="md:col-span-2 rounded-2xl border border-[#e4e4e7] bg-white p-6 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#71717a]">성장 현황</p>
                    <h2 className="text-xl font-black text-[#111111] mt-1 flex items-center gap-2">
                      {currentLevel.title}
                      {isMaxLevel && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${currentLevel.color}20`, color: currentLevel.color }}>MAX</span>}
                    </h2>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black" style={{ color: currentLevel.color }}>{totalXp}</p>
                    <p className="text-[10px] font-bold text-[#71717a]">총 XP</p>
                  </div>
                </div>

                {/* XP bar */}
                <div className="mb-2">
                  <div className="flex justify-between text-[11px] font-semibold mb-1.5">
                    <span style={{ color: currentLevel.color }}>LV.{currentLevel.level}</span>
                    {!isMaxLevel && <span className="text-[#71717a]">다음 레벨까지 {xpToNext} XP</span>}
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-[#f4f4f5]">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: currentLevel.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>

                {/* Stats row */}
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[#f9f9f9] p-3">
                    <p className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider">생성한 작품</p>
                    <p className="text-2xl font-black text-[#111111] mt-1">{status.campaignCount}<span className="text-xs font-semibold text-[#71717a] ml-1">개 (+{campaignXp} XP)</span></p>
                  </div>
                  <div className="rounded-xl bg-[#f9f9f9] p-3">
                    <p className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider">편집 피드백</p>
                    <p className="text-2xl font-black text-[#111111] mt-1">{status.editLogCount}<span className="text-xs font-semibold text-[#71717a] ml-1">회 (+{editXp} XP)</span></p>
                  </div>
                </div>
              </div>

              {/* XP gain guide */}
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-[#e4e4e7] px-4 py-2.5">
                <Zap className="h-3.5 w-3.5 text-[#eab308] shrink-0" />
                <p className="text-[11px] text-[#71717a] font-semibold">
                  카드뉴스 생성 시 <strong className="text-[#111111]">+10 XP</strong> · 에디터 수정 시 <strong className="text-[#111111]">+3 XP</strong>
                </p>
              </div>
            </motion.div>
          </div>

          {/* ── Learned skills ── */}
          <motion.div
            variants={itemVariants}
            className="mb-5 rounded-2xl border border-[#e4e4e7] bg-white p-6 shadow-sm"
          >
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#71717a] flex items-center gap-2 mb-4">
              <Star className="h-3.5 w-3.5" style={{ color: currentLevel.color }} />
              화가가 습득한 스킬
            </h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {currentLevel.skills.map((skill, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
                  style={{ backgroundColor: `${currentLevel.color}12`, color: currentLevel.color, border: `1px solid ${currentLevel.color}25` }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: currentLevel.color }} />
                  {skill}
                </span>
              ))}
              {currentLevelIdx < LEVELS.length - 1 && LEVELS[currentLevelIdx + 1].skills
                .filter(s => !currentLevel.skills.includes(s))
                .map((skill, i) => (
                  <span key={`next-${i}`} className="flex items-center gap-1.5 rounded-lg border border-dashed border-[#e4e4e7] px-3 py-1.5 text-xs font-semibold text-[#a1a1aa]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#e4e4e7]" />
                    {skill} <span className="text-[10px]">🔒</span>
                  </span>
                ))}
            </div>

            {!isMaxLevel && (
              <div className="flex items-start gap-3 rounded-xl bg-[#f9f9f9] px-4 py-3">
                <TrendingUp className="h-4 w-4 shrink-0 mt-0.5" style={{ color: currentLevel.color }} />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#71717a] mb-0.5">다음 레벨 달성 시</p>
                  <p className="text-xs font-semibold text-[#111111]">{currentLevel.nextLevelBonus}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-[#a1a1aa] shrink-0 mt-0.5 ml-auto" />
              </div>
            )}
          </motion.div>

          {/* ── Painter memory note ── */}
          <motion.div
            variants={itemVariants}
            className="mb-5 rounded-2xl border border-[#e4e4e7] bg-white p-6 shadow-sm"
          >
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#71717a] flex items-center gap-2 mb-4">
              <Sparkles className="h-3.5 w-3.5 text-[#0066ff]" />
              화가의 메모장 — 학습된 스타일 기록
            </h3>
            <div className="rounded-xl bg-[#faf9f5] border border-[#f0ece0] p-4">
              {hasPref ? (
                <>
                  <p className="text-xs leading-relaxed text-[#5c574f] font-semibold font-serif italic">
                    &ldquo; {prefSummary} &rdquo;
                  </p>
                  <p className="mt-3 text-[10px] text-[#a8a396] font-bold">최근 동기화: 실시간</p>
                </>
              ) : (
                <>
                  <p className="text-xs leading-relaxed text-[#8a8578] font-medium italic">
                    &ldquo; {prefSummary} &rdquo;
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-[#e8e3d8] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#c5b89a] transition-all duration-500"
                        style={{ width: `${Math.min(progressPercent, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-[#a8a396] font-bold shrink-0">학습 {Math.round(progressPercent)}%</p>
                  </div>
                </>
              )}
            </div>

            {/* Preference details */}
            {status.preference?.preferredCopyTone && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-lg border border-[#0066ff]/20 bg-[#0066ff]/5 px-3 py-1.5 text-xs font-semibold text-[#0066ff]">
                  카피 톤: {
                    status.preference.preferredCopyTone === 'short_punchy' ? '짧고 강렬한 슬로건' :
                    status.preference.preferredCopyTone === 'emotional' ? '따뜻한 감성 전달' :
                    status.preference.preferredCopyTone === 'informational' ? '차분한 정보 전달' :
                    '고급스럽고 우아한 톤'
                  }
                </span>
              </div>
            )}
          </motion.div>

          {/* ── Activity log ── */}
          <motion.div
            variants={itemVariants}
            className="rounded-2xl border border-[#e4e4e7] bg-white p-6 shadow-sm"
          >
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#71717a] flex items-center gap-2 mb-4">
              <FileText className="h-3.5 w-3.5 text-[#0066ff]" />
              화가 학습 일지
            </h3>

            {status.campaignCount > 0 || status.editLogCount > 0 ? (
              <div className="divide-y divide-[#f4f4f5] text-xs">
                {status.campaignCount > 0 && (
                  <div className="flex items-center justify-between py-3 first:pt-0">
                    <div className="flex items-center gap-3">
                      <span className="inline-block h-2 w-2 rounded-full bg-[#3b82f6]" />
                      <span className="font-semibold text-[#111111]">카드뉴스 {status.campaignCount}개 생성 완료</span>
                    </div>
                    <span className="font-black text-[#16a34a]">+{campaignXp} XP</span>
                  </div>
                )}
                {status.editLogCount > 0 && (
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-block h-2 w-2 rounded-full bg-[#8b5cf6]" />
                      <span className="font-semibold text-[#111111]">에디터 피드백 {status.editLogCount}회 기록</span>
                    </div>
                    <span className="font-black text-[#16a34a]">+{editXp} XP</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-3 last:pb-0">
                  <div className="flex items-center gap-3">
                    <Award className="h-3.5 w-3.5 text-[#eab308]" />
                    <span className="font-semibold text-[#111111]">현재 레벨: {currentLevel.title}</span>
                  </div>
                  <span className="font-bold text-[#71717a]">LV.{currentLevel.level}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 space-y-2">
                <div className="flex justify-center">
                  <div className="h-12 w-12 rounded-full bg-[#f4f4f5] flex items-center justify-center">
                    <span className="text-2xl">🎨</span>
                  </div>
                </div>
                <p className="text-sm font-bold text-[#111111]">아직 작품이 없습니다</p>
                <p className="text-xs text-[#71717a] max-w-xs mx-auto leading-relaxed">
                  첫 번째 카드뉴스를 생성하면 화가가 학습을 시작합니다. 생성→편집을 반복할수록 화가가 브랜드를 더 깊이 이해합니다.
                </p>
              </div>
            )}
          </motion.div>

        </motion.div>
      </div>
    </div>
  )
}
