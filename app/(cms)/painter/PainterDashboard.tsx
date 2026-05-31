'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Sparkles, Palette, Loader2, Award, FileText, Settings, Heart, Brush } from 'lucide-react'
import { getPainterStatusAction } from '../../actions'

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

// Level Definition
interface LevelInfo {
  level: number
  title: string
  titleEn: string
  xpRequired: number
  desc: string
  descEn: string
  color: string
}

const LEVELS: LevelInfo[] = [
  {
    level: 1,
    title: '신진 아티스트',
    titleEn: 'Emerging Artist',
    xpRequired: 30,
    desc: '이제 막 작품 활동을 시작했습니다. 선호하는 화풍과 톤을 학습하는 단계입니다.',
    descEn: 'Just started painting. Learning your preferred layout, color, and copy patterns.',
    color: '#3b82f6', // Blue
  },
  {
    level: 2,
    title: '기성 아티스트',
    titleEn: 'Established Artist',
    xpRequired: 80,
    desc: '점점 자신만의 스타일이 보이기 시작합니다. 레이아웃과 구도를 고유한 방식으로 전개합니다.',
    descEn: 'Developing a signature style. Customizing layouts in unique ways.',
    color: '#8b5cf6', // Purple
  },
  {
    level: 3,
    title: '전문 아티스트',
    titleEn: 'Professional Artist',
    xpRequired: 180,
    desc: '독창적인 화풍이 확립되었습니다. 디테일한 편집 피드백을 기억하고 적용합니다.',
    descEn: 'Original style established. Incorporating detailed editor feedback seamlessly.',
    color: '#ec4899', // Pink
  },
  {
    level: 4,
    title: '마스터 크리에이터',
    titleEn: 'Master Creator',
    xpRequired: 999999,
    desc: '거장의 반열에 올랐습니다. 사용자가 추구하는 시각적 톤앤매너와 레이아웃 흐름을 완벽히 이해합니다.',
    descEn: 'Artistic master. Fully comprehends your core visuals and campaign flows.',
    color: '#eab308', // Gold
  },
]

export default function PainterDashboard({ brand }: PainterDashboardProps) {
  const t = useTranslations('cms')
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

  // Calculate XP
  const campaignXp = status.campaignCount * 10
  const editXp = status.editLogCount * 3
  const totalXp = campaignXp + editXp

  // Find level
  let currentLevel = LEVELS[0]
  let xpIntoLevel = totalXp
  let xpNeededForNext = LEVELS[0].xpRequired
  let progressPercent = 0

  for (let i = 0; i < LEVELS.length; i++) {
    const lvl = LEVELS[i]
    if (totalXp >= lvl.xpRequired) {
      if (i < LEVELS.length - 1) {
        currentLevel = LEVELS[i + 1]
        xpIntoLevel = totalXp - lvl.xpRequired
        xpNeededForNext = LEVELS[i + 1].xpRequired - lvl.xpRequired
        progressPercent = Math.min((xpIntoLevel / xpNeededForNext) * 100, 100)
      } else {
        currentLevel = lvl
        xpIntoLevel = totalXp
        xpNeededForNext = lvl.xpRequired
        progressPercent = 100
      }
    } else {
      if (i === 0) {
        xpIntoLevel = totalXp
        xpNeededForNext = lvl.xpRequired
        progressPercent = Math.min((xpIntoLevel / xpNeededForNext) * 100, 100)
      }
      break
    }
  }

  // Set default preference memory summary if database is empty
  const defaultSummaryKo = `아직 충분한 편집 기록이 수집되지 않았습니다. 카드뉴스를 생성하고 에디터에서 배경이미지, 텍스트 배치, 컬러를 수정할수록 화가가 사용자의 고유한 화풍을 고도화하여 학습하게 됩니다.`
  const defaultSummaryEn = `Not enough edit logs gathered yet. As you generate card news and modify layout, colors, and font styles in the canvas, the artist will personalize its visual decisions to match your brand style.`
  
  const hasPref = status.preference && status.preference.summary
  const prefSummary = hasPref ? status.preference!.summary : (t('language_toggle') === 'EN' ? defaultSummaryKo : defaultSummaryEn)

  // Activities logs list mock (always computed relative to actual count to feel live)
  const activities = [
    { type: 'draft', desc: '새로운 카드뉴스 기획 및 생성 완료', xp: 10, time: '최근 생성' },
    status.editLogCount > 0 ? { type: 'edit', desc: '에디터 캔버스 텍스트 위치 및 구도 보정', xp: 3, time: '실시간 반영' } : null,
    status.editLogCount > 1 ? { type: 'edit', desc: '브랜드 메인 테마 컬러 조화 분석 및 스타일 적용', xp: 3, time: '실시간 반영' } : null,
    status.editLogCount > 2 ? { type: 'edit', desc: '참고 기사 핵심 키워드 매칭 정밀 편집 피드백 반영', xp: 3, time: '실시간 반영' } : null,
  ].filter(Boolean) as { type: string; desc: string; xp: number; time: string }[]

  return (
    <div className="flex h-full overflow-y-auto bg-[#fafafa]">
      <div className="flex-1">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-4xl px-6 py-12"
        >
          {/* Motto / Philosophy Banner */}
          <motion.div
            variants={itemVariants}
            className="relative mb-8 overflow-hidden rounded-2xl border border-[#0066ff]/15 bg-gradient-to-r from-[#0066ff]/5 via-[#0066ff]/2 to-transparent p-6 shadow-sm"
          >
            <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-[#0066ff]/5 blur-2xl" />
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm border border-[#e4e4e7]">
                <Brush className="h-5 w-5 text-[#0066ff]" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#0066ff]">{t('nav_painter')}</p>
                <h1 className="mt-2 text-[17px] font-black leading-snug tracking-tight text-[#111111] italic">
                  &ldquo;{t('painter_philosophy')}&rdquo;
                </h1>
              </div>
            </div>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Growth Level Card */}
            <motion.div
              variants={itemVariants}
              className="md:col-span-2 rounded-2xl border border-[#e4e4e7] bg-white p-6 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-[#f4f4f5] pb-4 mb-5">
                  <h3 className="text-sm font-bold text-[#111111] flex items-center gap-2">
                    <Award className="h-4.5 w-4.5 text-[#0066ff]" />
                    화가 성장 등급
                  </h3>
                  <span className="rounded-full bg-[#0066ff]/10 px-2.5 py-1 text-[10px] font-bold text-[#0066ff]">
                    LV. {currentLevel.level}
                  </span>
                </div>

                <div className="flex items-start gap-5">
                  {/* Dynamic Visual Avatar Container */}
                  <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-[#e4e4e7] bg-gradient-to-tr from-[#fbfbfe] to-[#f4f4f7] shadow-inner overflow-hidden">
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#0066ff_1px,transparent_1px)] [background-size:12px_12px]" />
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                      className="absolute inset-2 rounded-full border border-dashed border-[#0066ff]/20"
                    />
                    
                    {/* SVG Graphic specific to stage */}
                    {currentLevel.level === 1 && (
                      <svg className="h-10 w-10 text-[#3b82f6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                    )}
                    {currentLevel.level === 2 && (
                      <svg className="h-11 w-11 text-[#8b5cf6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
                        <path d="M12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z" />
                        <circle cx="12" cy="12" r="1" fill="currentColor" />
                      </svg>
                    )}
                    {currentLevel.level === 3 && (
                      <svg className="h-11 w-11 text-[#ec4899]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    )}
                    {currentLevel.level === 4 && (
                      <svg className="h-11 w-11 text-[#eab308]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 2 7 12 12 22 7 12 2" />
                        <polyline points="2 17 12 22 22 17" />
                        <polyline points="2 12 12 17 22 12" />
                      </svg>
                    )}
                  </div>

                  <div>
                    <h4 className="text-base font-black text-[#111111]">
                      {t('language_toggle') === 'EN' ? currentLevel.title : currentLevel.titleEn}
                    </h4>
                    <p className="text-xs text-[#52525b] mt-1.5 leading-relaxed">
                      {t('language_toggle') === 'EN' ? currentLevel.desc : currentLevel.descEn}
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress Slider */}
              <div className="mt-8 border-t border-[#f4f4f5] pt-5">
                <div className="flex justify-between items-center text-xs font-semibold mb-2">
                  <span className="text-[#71717a]">누적 경험치 {totalXp} XP</span>
                  {currentLevel.level < 4 ? (
                    <span className="text-[#111111]">다음 레벨까지 {xpNeededForNext - xpIntoLevel} XP 필요</span>
                  ) : (
                    <span className="text-[#eab308]">MAX LEVEL REACHED</span>
                  )}
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#f4f4f5]">
                  <motion.div
                    className="h-full rounded-full bg-[#0066ff]"
                    style={{ backgroundColor: currentLevel.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </motion.div>

            {/* Micro Stats Card */}
            <motion.div
              variants={itemVariants}
              className="rounded-2xl border border-[#e4e4e7] bg-white p-6 shadow-sm flex flex-col justify-between"
            >
              <div>
                <h3 className="text-sm font-bold text-[#111111] flex items-center gap-2 border-b border-[#f4f4f5] pb-4 mb-5">
                  <Settings className="h-4.5 w-4.5 text-[#0066ff]" />
                  아티스트 통계
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider">누적 작품 생성</p>
                    <p className="text-2xl font-black text-[#111111] mt-0.5">{status.campaignCount} <span className="text-xs font-semibold text-[#71717a]">작품</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider">에디터 정밀 피드백</p>
                    <p className="text-2xl font-black text-[#111111] mt-0.5">{status.editLogCount} <span className="text-xs font-semibold text-[#71717a]">회</span></p>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-[#a1a1aa] mt-4 leading-normal font-medium">캠페인 생성 시 +10 XP,<br />레이아웃/문구 수정 시 +3 XP 획득</p>
            </motion.div>
          </div>

          {/* Preference Details Card */}
          <motion.div
            variants={itemVariants}
            className="mt-6 rounded-2xl border border-[#e4e4e7] bg-white p-6 shadow-sm"
          >
            <h3 className="text-sm font-bold text-[#111111] flex items-center gap-2 border-b border-[#f4f4f5] pb-4 mb-5">
              <Sparkles className="h-4.5 w-4.5 text-[#0066ff]" />
              화풍 및 레이아웃 선호도 분석
            </h3>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4.5">
                {/* Preferred copywriting style */}
                <div>
                  <p className="text-xs font-bold text-[#52525b] mb-2">선호 카피라이팅 톤</p>
                  <div className="flex flex-wrap gap-2">
                    {status.preference?.preferredCopyTone ? (
                      <span className="rounded-lg border border-[#0066ff]/20 bg-[#0066ff]/5 px-3 py-1.5 text-xs font-semibold text-[#0066ff]">
                        {status.preference.preferredCopyTone === 'short_punchy' && '짧고 강렬한 슬로건 톤'}
                        {status.preference.preferredCopyTone === 'emotional' && '따뜻한 감성 전달 톤'}
                        {status.preference.preferredCopyTone === 'informational' && '차분하고 정밀한 정보 전달 톤'}
                        {status.preference.preferredCopyTone === 'luxury' && '고급스럽고 우아한 브랜드 톤'}
                      </span>
                    ) : (
                      <span className="rounded-lg border border-dashed border-[#e4e4e7] px-3 py-1.5 text-xs font-semibold text-[#71717a]">
                        톤앤매너 학습 대기 중
                      </span>
                    )}
                  </div>
                </div>

                {/* Target Emotion tags */}
                <div>
                  <p className="text-xs font-bold text-[#52525b] mb-2">화가가 분석한 선호 감성</p>
                  <div className="flex flex-wrap gap-1.5">
                    {status.campaignCount > 0 ? (
                      <>
                        <span className="flex items-center gap-1 rounded-md bg-[#fff1f2] border border-[#ffe4e6] px-2 py-1 text-[11px] font-medium text-[#e11d48]">
                          <Heart className="h-3 w-3 fill-current" /> 신뢰감
                        </span>
                        <span className="flex items-center gap-1 rounded-md bg-[#f0fdf4] border border-[#dcfce7] px-2 py-1 text-[11px] font-medium text-[#16a34a]">
                          <Heart className="h-3 w-3 fill-current" /> 호기심
                        </span>
                        <span className="flex items-center gap-1 rounded-md bg-[#f0f9ff] border border-[#e0f2fe] px-2 py-1 text-[11px] font-medium text-[#0284c7]">
                          <Heart className="h-3 w-3 fill-current" /> 유익함
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-[#71717a] italic">작품 생성을 시작하면 선호 감성을 수집합니다.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Memory summary handwriting style box */}
              <div className="rounded-xl bg-[#faf9f5] border border-[#f0ece0] p-4 flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[#8a8578] uppercase tracking-wider mb-2">화가의 메모 및 화풍 기록</p>
                  <p className="text-xs leading-relaxed text-[#5c574f] font-semibold font-serif italic">
                    &ldquo; {prefSummary} &rdquo;
                  </p>
                </div>
                {hasPref && (
                  <span className="text-[10px] text-[#a8a396] self-end mt-4">최근 동기화: 실시간</span>
                )}
              </div>
            </div>
          </motion.div>

          {/* XP History Activities Logs */}
          <motion.div
            variants={itemVariants}
            className="mt-6 rounded-2xl border border-[#e4e4e7] bg-white p-6 shadow-sm"
          >
            <h3 className="text-sm font-bold text-[#111111] flex items-center gap-2 border-b border-[#f4f4f5] pb-4 mb-4">
              <FileText className="h-4.5 w-4.5 text-[#0066ff]" />
              화가 학습 일지 (최근 활동)
            </h3>
            {activities.length > 0 ? (
              <div className="divide-y divide-[#f4f4f5] text-xs">
                {activities.map((act, index) => (
                  <div key={index} className="flex items-center justify-between py-3.5 first:pt-1 last:pb-1">
                    <div className="flex items-center gap-3">
                      <span className={`inline-block h-2 w-2 rounded-full ${act.type === 'draft' ? 'bg-[#3b82f6]' : 'bg-[#8b5cf6]'}`} />
                      <span className="font-semibold text-[#111111]">{act.desc}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[#a1a1aa] font-medium">{act.time}</span>
                      <span className="font-black text-[#16a34a]">+{act.xp} XP</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-[#71717a] font-medium italic">
                에디터를 수정하거나 카드뉴스를 생성하면 여기에 학습 일지가 기록됩니다.
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
