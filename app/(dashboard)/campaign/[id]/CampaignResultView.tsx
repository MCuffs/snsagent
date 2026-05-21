'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  updateSlideAction, 
  updatePostDetailsAction, 
  approveAndScheduleCampaignAction,
  regenerateCampaignImagesAction 
} from '../../../actions'
import { 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Edit3, 
  Calendar, 
  Clock, 
  ArrowRight,
  RefreshCw,
  Eye,
  Settings,
  AlertCircle,
  Loader2,
  Palette
} from 'lucide-react'

interface Slide {
  id: string
  slideNumber: number
  headline: string
  body: string
  designPrompt: string
  imageUrl: string | null
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
  slides: Slide[]
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
}

interface CampaignResultViewProps {
  campaign: Campaign
  post: Post
  brand: Brand
  userPlan: string
  hasWatermark: boolean
  canSchedule: boolean
}

const VISUAL_STYLES = [
  { key: 'minimalist', name: '미니멀리스트', desc: '북유럽풍 파스텔톤과 깔끔한 단색 조화' },
  { key: 'gradients', name: '그라데이션 팝', desc: '트렌디한 입체적 글래스모피즘 그라데이션' },
  { key: 'cyberpunk', name: '네온 사이버', desc: '미래지향적인 네온 다크 테크 스타일' },
  { key: 'vector', name: '플랫 일러스트', desc: '귀엽고 친근한 2D 플랫 벡터 캐릭터' },
  { key: 'photo', name: '스튜디오 화보', desc: '프리미엄 상업 브랜드 스튜디오 실사 화보' }
]

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export default function CampaignResultView({
  campaign,
  post,
  brand,
  userPlan,
  hasWatermark,
  canSchedule
}: CampaignResultViewProps) {
  const router = useRouter()
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [slides, setSlides] = useState<Slide[]>(
    [...campaign.slides].sort((a, b) => a.slideNumber - b.slideNumber)
  )
  
  // Slide edit state
  const [editingHeadline, setEditingHeadline] = useState(slides[0]?.headline || '')
  const [editingBody, setEditingBody] = useState(slides[0]?.body || '')
  const [updatingSlide, setUpdatingSlide] = useState(false)

  // Visual style state
  const [selectedStyle, setSelectedStyle] = useState('minimalist')
  const [regenerating, setRegenerating] = useState(false)

  // Caption/Schedule state
  const [caption, setCaption] = useState(post.caption)
  const [hashtags, setHashtags] = useState(post.hashtags)
  
  // Format date to local datetime string: YYYY-MM-DDThh:mm
  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  const [scheduledAt, setScheduledAt] = useState(formatDateTime(post.scheduledAt))
  
  // Operation Status
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const activeSlide = slides[activeSlideIndex]

  // Sync edit state when active slide changes
  const handleSlideChange = (index: number) => {
    setActiveSlideIndex(index)
    setEditingHeadline(slides[index].headline)
    setEditingBody(slides[index].body)
  }

  // Save current slide text edits to DB & local state
  const handleSaveSlideTexts = async () => {
    if (!activeSlide) return
    setUpdatingSlide(true)
    setMessage(null)
    try {
      const res = await updateSlideAction(activeSlide.id, editingHeadline, editingBody)
      if (res.success && res.slide) {
        // Update local state
        const updatedSlides = slides.map(s => {
          if (s.id === activeSlide.id) {
            return {
              ...s,
              headline: editingHeadline,
              body: editingBody
            }
          }
          return s
        })
        setSlides(updatedSlides)
        setMessage({ type: 'success', text: `${activeSlide.slideNumber}번 슬라이드 문구가 반영되었습니다.` })
      } else {
        setMessage({ type: 'error', text: res.error || '슬라이드 수정에 실패했습니다.' })
      }
    } catch (e: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(e, '네트워크 오류가 발생했습니다.') })
    } finally {
      setUpdatingSlide(false)
    }
  }

  // Batch regenerate slide images with selected visual style
  const handleRegenerateStyle = async () => {
    setRegenerating(true)
    setMessage(null)
    try {
      const res = await regenerateCampaignImagesAction(campaign.id, selectedStyle)
      if (res.success && res.slides) {
        setSlides(res.slides)
        // Reset preview back to slide 1
        setActiveSlideIndex(0)
        setEditingHeadline(res.slides[0]?.headline || '')
        setEditingBody(res.slides[0]?.body || '')
        setMessage({ 
          type: 'success', 
          text: `성공: 카드뉴스 시안 이미지가 '${VISUAL_STYLES.find(s => s.key === selectedStyle)?.name}' 컨셉으로 일괄 재생성되었습니다.` 
        })
      } else {
        setMessage({ type: 'error', text: res.error || '스타일 재생성에 실패했습니다.' })
      }
    } catch (e: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(e, '디자인 재생성 중 네트워크 에러가 발생했습니다.') })
    } finally {
      setRegenerating(false)
    }
  }

  // Approve campaign and queue schedule
  const handleApprove = async () => {
    setLoading(true)
    setMessage(null)

    try {
      // First save caption/hashtags details
      await updatePostDetailsAction(post.id, caption, hashtags)

      const res = await approveAndScheduleCampaignAction(campaign.id, post.id, {
        caption,
        hashtags,
        scheduledAt: new Date(scheduledAt).toISOString()
      })

      if (res.success) {
        setMessage({ type: 'success', text: res.message || '인스타그램 등록 성공!' })
        // Redirect to calendar after short delay
        setTimeout(() => {
          router.push('/calendar')
        }, 1500)
      } else {
        setMessage({ type: 'error', text: res.error || '승인 처리 등록에 실패했습니다.' })
        setLoading(false)
      }
    } catch (e: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(e, '네트워크 오류가 발생했습니다.') })
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-[#ff4f00]/10 text-[#ff4f00] border border-[#ff4f00]/20">AI 초안 기획 완성</span>
            <span className="text-[10px] text-slate-400 font-bold">캠페인 ID: {campaign.id}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">시안 검토 및 승인</h1>
        </div>

        <button
          onClick={() => router.push('/campaign/new')}
          className="px-4 py-2.5 rounded-lg text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>다시 생성 (처음으로)</span>
        </button>
      </div>

      {/* Message Notifications */}
      {message && (
        <div className={`p-4 rounded-lg border flex gap-2.5 text-xs font-semibold ${
          message.type === 'success' 
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700' 
            : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Grid: Left Side Mockup, Right Side Inputs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Card Visual Preview Mockup (Col span 5) */}
        <div className="lg:col-span-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-[#ff4f00]" />
            <span>카드뉴스 모바일 실시간 미리보기</span>
          </h2>

          {/* Instagram Square Card Mockup */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-lg relative">
            <div className="aspect-square w-full relative flex flex-col justify-between p-10 select-none overflow-hidden"
              style={{
                backgroundImage: activeSlide?.imageUrl ? `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.75)), url(${activeSlide.imageUrl})` : 'linear-gradient(to bottom, #eaeaea, #d5d5d5)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              {/* Slide Number Badge */}
              <div className="self-end px-3 py-1 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-bold text-white tracking-widest border border-white/10">
                {activeSlideIndex + 1} / {slides.length}
              </div>

              {/* Title & Body Card Layout (Styled using Brand Color) */}
              <div className="space-y-4 my-auto text-center px-4">
                <h3 className="text-xl sm:text-2xl font-black text-white leading-snug drop-shadow-md whitespace-pre-line border-b-2 pb-4 inline-block max-w-full"
                  style={{ borderColor: brand.mainColor || '#ff4f00' }}
                >
                  {editingHeadline}
                </h3>
                <p className="text-xs sm:text-sm text-slate-100 font-medium leading-relaxed drop-shadow whitespace-pre-line">
                  {editingBody}
                </p>
              </div>

              {/* Card Footer: Brand watermark & Instagram styling indicators */}
              <div className="flex justify-between items-center text-[10px] text-white/50">
                <span className="font-semibold">{brand.name}</span>
                {hasWatermark && (
                  <span className="bg-black/60 px-2 py-0.5 rounded border border-white/5 font-extrabold tracking-widest text-[8px] uppercase text-[#ff4f00]">
                    Watermark: InstaAgent
                  </span>
                )}
              </div>
            </div>

            {/* Slider Controls */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
              <button
                type="button"
                onClick={() => handleSlideChange(Math.max(0, activeSlideIndex - 1))}
                disabled={activeSlideIndex === 0}
                className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div className="flex gap-1.5">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSlideChange(idx)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      activeSlideIndex === idx ? 'w-5 bg-[#ff4f00]' : 'bg-slate-200'
                    }`}
                  ></button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleSlideChange(Math.min(slides.length - 1, activeSlideIndex + 1))}
                disabled={activeSlideIndex === slides.length - 1}
                className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-2.5 text-xs text-slate-500 font-medium">
            <Edit3 className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="leading-relaxed">
              슬라이드 배경 이미지는 AI가 다음 가이드로 그린 초안입니다:<br />
              <span className="italic text-slate-700 font-semibold">&ldquo;{activeSlide?.designPrompt.slice(0, 60)}...&rdquo;</span>
            </p>
          </div>
        </div>

        {/* Right Side Settings & Edit Inputs (Col span 7) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Visual Style Switcher Panel */}
          <div className="border border-slate-200 rounded-xl bg-white p-6 space-y-4 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Palette className="w-4.5 h-4.5 text-[#ff4f00]" />
              <span>디자인 비주얼 스타일 스위처 (AI 테마)</span>
            </h3>

            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              카드뉴스의 그래픽 스타일을 선택해 일괄 리프레시할 수 있습니다. 원하는 테마 선택 후 적용 버튼을 클릭하세요.
            </p>

            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {VISUAL_STYLES.map((style) => (
                  <button
                    key={style.key}
                    type="button"
                    onClick={() => !regenerating && setSelectedStyle(style.key)}
                    disabled={regenerating}
                    className={`p-2.5 text-left rounded-lg border transition-all cursor-pointer ${
                      selectedStyle === style.key
                        ? 'border-[#ff4f00] bg-[#ff4f00]/5 text-[#ff4f00] shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    } disabled:opacity-50`}
                  >
                    <p className="text-xs font-bold">{style.name}</p>
                    <p className="text-[9px] text-slate-450 mt-0.5 font-medium leading-none truncate">{style.desc}</p>
                  </button>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleRegenerateStyle}
                  disabled={regenerating}
                  className="px-4 py-2.5 rounded-lg text-xs font-bold bg-[#ff4f00] hover:bg-[#e04500] text-white flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors disabled:opacity-55"
                >
                  {regenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>AI 새 스타일 드로잉 중 (15초 소요)...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>스타일 적용 및 전체 이미지 재생성</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Card Content Typo Editor */}
          <div className="border border-slate-200 rounded-xl bg-white p-6 space-y-4 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Settings className="w-4.5 h-4.5 text-[#ff4f00]" />
              <span>{activeSlideIndex + 1}번 카드뉴스 텍스트 편집</span>
            </h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  슬라이드 헤드카피 (제목)
                </label>
                <input
                  type="text"
                  value={editingHeadline}
                  onChange={(e) => setEditingHeadline(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-950 focus:outline-none focus:border-[#ff4f00] transition-all font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  슬라이드 본문 카피
                </label>
                <textarea
                  rows={2}
                  value={editingBody}
                  onChange={(e) => setEditingBody(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-950 focus:outline-none focus:border-[#ff4f00] transition-all leading-relaxed"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveSlideTexts}
                  disabled={updatingSlide}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50 shadow-sm"
                >
                  {updatingSlide ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  )}
                  <span>슬라이드 문구 적용</span>
                </button>
              </div>
            </div>
          </div>

          {/* Instagram Post Detail Editor */}
          <div className="border border-slate-200 rounded-xl bg-white p-6 space-y-4 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm">인스타그램 업로드 캡션 및 해시태그</h3>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  피드 캡션 본문
                </label>
                <textarea
                  rows={6}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-950 focus:outline-none focus:border-[#ff4f00] transition-all font-sans leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  해시태그 (쉼표로 구분)
                </label>
                <input
                  type="text"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-950 focus:outline-none focus:border-[#ff4f00] transition-all font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Schedule Date Time Picker & Approval */}
          <div className="border border-slate-200 rounded-xl bg-white p-6 space-y-4 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Calendar className="w-4.5 h-4.5 text-[#ff4f00]" />
              <span>발행 스케줄 및 승인 실행</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  예약 일시 선택
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-950 focus:outline-none focus:border-[#ff4f00] transition-all font-semibold"
                />
              </div>
              
              <div className="p-4 rounded-lg border border-slate-250 bg-slate-50 flex flex-col justify-center">
                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-1">AI 추천 발행 시간대</p>
                <p className="text-xs text-slate-800 font-extrabold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  <span>오늘 오후 06:30 (타겟 고객 활동 피크 타임)</span>
                </p>
              </div>
            </div>

            {/* Plan restriction warning */}
            {!canSchedule && (
              <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50 text-[11px] text-amber-800 flex items-start gap-2 leading-relaxed">
                <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5 text-amber-600" />
                <p className="font-medium">
                  **요금제 제한**: 현재 사용 중인 {userPlan} 플랜은 예약 업로드 자동화가 지원되지 않습니다. 승인 버튼 클릭 시 대시보드 저장은 완료되나, Instagram 자동 전송은 대기 상태(draft)로 멈춥니다. 자동 예약을 원하시면 Starter 요금제 이상으로 결제해 주세요.
                </p>
              </div>
            )}

            <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <span className="text-[10px] text-slate-400 font-semibold leading-relaxed max-w-sm">
                승인 및 예약을 확정하면 지정된 예약 시간에 맞춰 AI 직원이 피드 발행을 대행합니다.
              </span>
              <button
                type="button"
                onClick={handleApprove}
                disabled={loading}
                className="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-extrabold bg-[#ff4f00] hover:bg-[#e04500] text-white flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/10 cursor-pointer disabled:opacity-55 transition-all active:scale-[0.98]"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>승인 및 인스타그램 예약</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
