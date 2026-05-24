'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, Briefcase, Info, Save, Sparkles, CheckCircle2, ChevronDown, ChevronUp, Globe } from 'lucide-react'
import { saveBrandAction, analyzeBrandWebsiteAction } from '../../actions'

const industries = ['온라인 스토어', '카페 / F&B', '피트니스', '뷰티 / 케어', '교육 / 강의', 'IT / SaaS']
const tones = ['친근하고 명확한 톤', '전문적이고 신뢰감 있는 톤', '젊고 경쾌한 톤', '고급스럽고 차분한 톤']
const ctas = ['프로필 링크에서 예약하기', 'DM으로 문의하기', '무료 상담 신청하기', '스토어에서 자세히 보기']

interface BrandData {
  id: string
  name: string
  industry: string
  targetAudience: string
  toneOfVoice: string
  mainColor: string
  forbiddenWords: string
  ctaStyle: string
  brandDna?: string | null
}

interface BrandFormProps {
  existingBrand: BrandData | null
  limitAllowed: boolean
  limitCount: number
  userPlan: string
}

export default function BrandForm({ existingBrand, limitAllowed, limitCount, userPlan }: BrandFormProps) {
  const router = useRouter()
  const [currentBrandId, setCurrentBrandId] = useState(existingBrand?.id || null)
  
  // Form State
  const [name, setName] = useState(existingBrand?.name || '')
  const [industry, setIndustry] = useState(existingBrand?.industry || '')
  const [targetAudience, setTargetAudience] = useState(existingBrand?.targetAudience || '')
  const [toneOfVoice, setToneOfVoice] = useState(existingBrand?.toneOfVoice || '')
  const [mainColor, setMainColor] = useState(existingBrand?.mainColor || '#b94718')
  const [forbiddenWords, setForbiddenWords] = useState(existingBrand?.forbiddenWords || '')
  const [ctaStyle, setCtaStyle] = useState(existingBrand?.ctaStyle || '')
  const [brandDna, setBrandDna] = useState(existingBrand?.brandDna || null)

  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  
  // AI Profiler State
  const [url, setUrl] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzeStep, setAnalyzeStep] = useState(0)
  const [analysisReport, setAnalysisReport] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(true)
  const [highlightFields, setHighlightFields] = useState(false)

  // Step names for AI profiling interaction
  const analyzeSteps = [
    '🔗 웹사이트 데이터 스크래핑 중...',
    '🤖 브랜드 주요 가치 및 정체성 분석 중...',
    '🎨 브랜드 메인 비주얼 테마 컬러 추출 중...',
    '✨ 브랜드 콘텐츠 가이드라인 생성 중...',
  ]

  useEffect(() => {
    if (isAnalyzing) {
      const interval = setInterval(() => {
        setAnalyzeStep((prev) => (prev < 3 ? prev + 1 : prev))
      }, 1500)
      return () => clearInterval(interval)
    }
  }, [isAnalyzing])

  const handleAIAnalyze = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url) return
    
    setIsAnalyzing(true)
    setAnalyzeStep(0)
    setFormError(null)
    setFormSuccess(null)
    setAnalysisReport(null)

    try {
      const res = await analyzeBrandWebsiteAction(url)
      
      if (!res.success) {
        setFormError(res.error || 'AI 브랜드 분석에 실패했습니다.')
        setIsAnalyzing(false)
        return
      }

      if (res.brandProfile) {
        const { name, industry, targetAudience, toneOfVoice, mainColor, forbiddenWords, ctaStyle, brandDna } = res.brandProfile
        
        // Populate form with animation delay
        setName(name)
        setIndustry(industry)
        setTargetAudience(targetAudience)
        setToneOfVoice(toneOfVoice)
        setMainColor(mainColor)
        setForbiddenWords(forbiddenWords)
        setCtaStyle(ctaStyle)
        setBrandDna(brandDna || null)
        
        if (res.markdownReport) {
          setAnalysisReport(res.markdownReport)
          setShowReport(true)
        }

        // Trigger visual glow effect on inputs
        setHighlightFields(true)
        setTimeout(() => setHighlightFields(false), 3000)

        setFormSuccess('AI 분석이 완료되었습니다. 내용을 확인한 뒤 저장하기를 눌러 브랜드 정보를 저장하세요.')
      }
    } catch (err) {
      console.error(err)
      setFormError('서버 통신 중 오류가 발생했습니다.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const shouldGoToCampaign = !currentBrandId
    setIsSubmitting(true)
    setFormError(null)
    setFormSuccess(null)

    try {
      const res = await saveBrandAction(currentBrandId, {
        name,
        industry,
        targetAudience,
        toneOfVoice,
        mainColor,
        forbiddenWords,
        ctaStyle,
        brandDna,
      })

      if (res.success) {
        setCurrentBrandId(res.brand.id)
        setFormSuccess('브랜드 정보가 저장되었습니다.')
        if (shouldGoToCampaign) {
          router.push('/campaign/new')
        } else {
          router.refresh()
        }
      } else {
        setFormError(res.error || '저장에 실패했습니다.')
      }
    } catch (err) {
      console.error(err)
      setFormError('저장 중 예측하지 못한 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!currentBrandId) {
    const canSaveOnboarding = Boolean(name && industry && targetAudience && toneOfVoice && mainColor && ctaStyle)

    return (
      <div className="mx-auto flex min-h-[calc(100vh-76px)] max-w-3xl flex-col justify-center px-5 py-10 md:px-8">
        <div className="mb-8">
          <p className="eyebrow">Brand Onboarding</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-950 md:text-5xl">
            브랜드 웹사이트를 먼저 분석합니다.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#6f6a61]">
            처음 로그인한 사용자는 브랜드 설정을 완료해야 카드 만들기와 CMS 메뉴를 사용할 수 있습니다.
            브랜드 사이트 URL을 입력하면 AI가 기본 프로필을 채우고, 저장 후 바로 카드 만들기로 이동합니다.
          </p>
        </div>

        {formError && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>{formError}</p>
            </div>
          </div>
        )}

        {formSuccess && (
          <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
            <div className="flex gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <p>{formSuccess}</p>
            </div>
          </div>
        )}

        <section className="panel rounded-xl p-5 md:p-7">
          <form onSubmit={handleAIAnalyze} className="space-y-4">
            <label htmlFor="onboarding-url" className="block text-xs font-black uppercase tracking-[0.12em] text-[#6f6a61]">
              브랜드 사이트 URL
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Globe className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8479]" />
                <input
                  id="onboarding-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isAnalyzing}
                  required
                  placeholder="https://example.com"
                  className="field h-12 pl-11 pr-4 text-base"
                />
              </div>
              <button
                type="submit"
                disabled={isAnalyzing || !url}
                className="btn-primary h-12 shrink-0 px-5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                AI 분석 시작
              </button>
            </div>
          </form>

          {isAnalyzing && (
            <div className="mt-5 rounded-lg border border-[#dedbd2] bg-[#f8f3e9] p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-[#b94718]">{analyzeSteps[analyzeStep]}</span>
                <span className="text-xs text-[#6f6a61]">{Math.round(((analyzeStep + 1) / 4) * 100)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full bg-[#b94718] transition-all duration-1000 ease-out"
                  style={{ width: `${((analyzeStep + 1) / 4) * 100}%` }}
                />
              </div>
            </div>
          )}

          {analysisReport && (
            <div className="mt-6 rounded-lg border border-[#dedbd2] bg-white p-4">
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <SummaryItem label="브랜드명" value={name} />
                <SummaryItem label="업종" value={industry} />
                <SummaryItem label="타깃" value={targetAudience} />
                <SummaryItem label="톤앤매너" value={toneOfVoice} />
                <SummaryItem label="브랜드 컬러" value={mainColor} />
                <SummaryItem label="CTA" value={ctaStyle} />
              </div>

              <button
                type="button"
                onClick={() => setShowReport(!showReport)}
                className="mt-5 flex w-full items-center justify-between border-t border-[#ece9e0] pt-4 text-left text-xs font-black text-[#4a4039]"
              >
                AI 분석 리포트
                {showReport ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showReport && (
                <div className="mt-4 max-h-72 overflow-y-auto rounded-lg bg-[#fffdf8] p-4">
                  <MiniMarkdown content={analysisReport} />
                </div>
              )}
            </div>
          )}

          {analysisReport && (
            <form onSubmit={handleSubmit} className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || !canSaveOnboarding}
                className="btn-primary h-12 px-6 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                브랜드 저장하고 카드 만들기
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}
        </section>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8">
      {/* Page Header */}
      <div className="mb-8">
        <p className="eyebrow">Brand System</p>
        <div className="mt-3 flex items-start gap-3">
          <Briefcase className="mt-1 h-6 w-6 text-[#b94718]" />
          <div>
            <h1 className="text-3xl font-black tracking-tight text-neutral-950">브랜드 설정</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f6a61]">
              카드뉴스의 말투, 색상, 금칙어, CTA를 정의합니다. 이 정보가 모든 캠페인 생성의 기준이 됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* Limit Alert */}
      {!existingBrand && !limitAllowed && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>
              현재 {userPlan} 요금제에서는 브랜드를 최대 {limitCount}개까지 등록할 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {/* Form Success Banner */}
      {formSuccess && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <p>{formSuccess}</p>
          </div>
        </div>
      )}

      {/* Form Error Banner */}
      {formError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{formError}</p>
          </div>
        </div>
      )}

      {/* AI URL Profiler Section */}
      <div className="panel mb-8 rounded-lg p-6 border border-[#b94718]/20 bg-gradient-to-br from-[#fbfbfa] to-[#f5f3ef]">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-[#b94718]" />
          <h2 className="text-lg font-bold text-neutral-950">AI 브랜드 정보 자동 생성 (URL 입력)</h2>
        </div>
        <p className="text-xs text-[#6f6a61] mb-5">
          쇼핑몰, 스토어팜, 인스타그램 연동 링크 등 브랜드 웹사이트 URL을 입력하시면 AI가 직접 탐색해 브랜드 구도를 완벽하게 추출하여 가이드라인 및 폼을 채워줍니다.
        </p>

        <form onSubmit={handleAIAnalyze} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Globe className="absolute left-3.5 top-3.5 h-4 w-4 text-[#8a8479]" />
            <input
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isAnalyzing}
              required
              className="field h-11 pl-10 pr-3 w-full bg-white border-[#dedbd2] text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={isAnalyzing || !url}
            className="btn-primary shrink-0 h-11 px-6 bg-[#b94718] hover:bg-[#a33d13] text-white font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                분석 중...
              </span>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                AI 분석 시작
              </>
            )}
          </button>
        </form>

        {/* AI Analyze Progress Indicator */}
        {isAnalyzing && (
          <div className="mt-5 p-4 rounded-lg bg-[#f1f0eb] border border-[#dedbd2]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#b94718]">{analyzeSteps[analyzeStep]}</span>
              <span className="text-xs text-[#6f6a61]">{Math.round(((analyzeStep + 1) / 4) * 100)}%</span>
            </div>
            <div className="h-1.5 w-full bg-neutral-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#b94718] transition-all duration-1000 ease-out" 
                style={{ width: `${((analyzeStep + 1) / 4) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Brand Analysis Report Accordion */}
        {analysisReport && (
          <div className="mt-6 rounded-lg border border-[#dedbd2] bg-white overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setShowReport(!showReport)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#f1f0eb]/50 hover:bg-[#f1f0eb] border-b border-[#dedbd2] transition-colors"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                AI 브랜드 분석 보고서 생성 완료
              </div>
              {showReport ? <ChevronUp className="h-4 w-4 text-[#8a8479]" /> : <ChevronDown className="h-4 w-4 text-[#8a8479]" />}
            </button>
            {showReport && (
              <div className="p-5 max-h-96 overflow-y-auto">
                <MiniMarkdown content={analysisReport} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Brand Settings Form */}
      <form onSubmit={handleSubmit} className="panel rounded-lg p-6 md:p-8">
        <div className="mb-8 flex items-center gap-2 rounded-lg border border-[#dedbd2] bg-[#f1f0eb]/70 px-4 py-3 text-xs text-[#6f6a61]">
          <Info className="h-4 w-4 shrink-0" />
          기존 브랜드가 있으면 저장 시 현재 브랜드 정보가 업데이트됩니다.
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Brand Name */}
          <div>
            <label htmlFor="name" className="mb-2 block text-xs font-bold text-[#5d584f]">
              브랜드명
            </label>
            <input
              id="name"
              type="text"
              required
              placeholder="예: 모카 스튜디오"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`field h-11 px-3 w-full transition-all duration-500 ${
                highlightFields ? 'border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50/20' : 'border-[#dedbd2]'
              }`}
            />
          </div>

          {/* Industry */}
          <div>
            <label htmlFor="industry" className="mb-2 block text-xs font-bold text-[#5d584f]">
              업종
            </label>
            <input
              id="industry"
              type="text"
              required
              placeholder="예: 카페 / F&B"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              list="industries-list"
              className={`field h-11 px-3 w-full transition-all duration-500 ${
                highlightFields ? 'border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50/20' : 'border-[#dedbd2]'
              }`}
            />
            <datalist id="industries-list">
              {industries.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>

          {/* Target Audience */}
          <div>
            <label htmlFor="targetAudience" className="mb-2 block text-xs font-bold text-[#5d584f]">
              주요 고객
            </label>
            <input
              id="targetAudience"
              type="text"
              required
              placeholder="예: 2030 직장인 여성, 동네 단골 고객"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className={`field h-11 px-3 w-full transition-all duration-500 ${
                highlightFields ? 'border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50/20' : 'border-[#dedbd2]'
              }`}
            />
          </div>

          {/* Tone Of Voice */}
          <div>
            <label htmlFor="toneOfVoice" className="mb-2 block text-xs font-bold text-[#5d584f]">
              톤앤매너
            </label>
            <input
              id="toneOfVoice"
              type="text"
              required
              placeholder="예: 고급스럽고 차분한 톤"
              value={toneOfVoice}
              onChange={(e) => setToneOfVoice(e.target.value)}
              list="tones-list"
              className={`field h-11 px-3 w-full transition-all duration-500 ${
                highlightFields ? 'border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50/20' : 'border-[#dedbd2]'
              }`}
            />
            <datalist id="tones-list">
              {tones.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>

          {/* Brand Color */}
          <div>
            <label htmlFor="mainColor" className="mb-2 block text-xs font-bold text-[#5d584f]">
              브랜드 컬러
            </label>
            <div className="flex gap-2">
              <input
                id="mainColor"
                type="text"
                required
                placeholder="#B94718"
                value={mainColor}
                onChange={(e) => setMainColor(e.target.value)}
                className={`field h-11 px-3 flex-1 transition-all duration-500 ${
                  highlightFields ? 'border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50/20' : 'border-[#dedbd2]'
                }`}
              />
              <input
                type="color"
                value={mainColor.startsWith('#') && mainColor.length === 7 ? mainColor : '#b94718'}
                onChange={(e) => setMainColor(e.target.value)}
                className="h-11 w-12 rounded-lg border border-[#dedbd2] bg-white p-1 cursor-pointer"
                aria-label="브랜드 컬러 선택"
              />
            </div>
          </div>

          {/* CTA Style */}
          <div>
            <label htmlFor="ctaStyle" className="mb-2 block text-xs font-bold text-[#5d584f]">
              기본 CTA
            </label>
            <input
              id="ctaStyle"
              type="text"
              required
              placeholder="예: 프로필 링크에서 예약하기"
              value={ctaStyle}
              onChange={(e) => setCtaStyle(e.target.value)}
              list="ctas-list"
              className={`field h-11 px-3 w-full transition-all duration-500 ${
                highlightFields ? 'border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50/20' : 'border-[#dedbd2]'
              }`}
            />
            <datalist id="ctas-list">
              {ctas.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Forbidden Words */}
        <div className="mt-6">
          <label htmlFor="forbiddenWords" className="mb-2 block text-xs font-bold text-[#5d584f]">
            금칙어
          </label>
          <input
            id="forbiddenWords"
            type="text"
            placeholder="예: 100% 보장, 세계 최고, 최저가"
            value={forbiddenWords}
            onChange={(e) => setForbiddenWords(e.target.value)}
            className={`field h-11 px-3 w-full transition-all duration-500 ${
              highlightFields ? 'border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50/20' : 'border-[#dedbd2]'
            }`}
          />
          <p className="mt-2 text-xs text-[#6f6a61]">쉼표로 구분해 입력하세요.</p>
        </div>

        {/* Save Button */}
        <div className="mt-8 flex justify-end border-t border-[#ece9e0] pt-6">
          <button
            type="submit"
            disabled={isSubmitting || isAnalyzing || (!currentBrandId && !limitAllowed)}
            className="btn-primary px-5 disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2 bg-[#b94718] hover:bg-[#a33d13] text-white h-11 font-bold rounded-lg"
          >
            {isSubmitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            저장하기
          </button>
        </div>
      </form>
    </div>
  )
}

function MiniMarkdown({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="space-y-3 text-[#5d584f]">
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={idx} className="text-xl font-extrabold text-neutral-900 border-b border-[#dedbd2] pb-2 mt-4">
              {trimmed.replace('# ', '')}
            </h2>
          )
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="text-lg font-bold text-neutral-900 mt-4">
              {trimmed.replace('## ', '')}
            </h3>
          )
        }
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="text-base font-semibold text-neutral-800 mt-3">
              {trimmed.replace('### ', '')}
            </h4>
          )
        }
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          return (
            <li key={idx} className="ml-5 list-disc text-sm text-[#6f6a61]">
              {trimmed.substring(2)}
            </li>
          )
        }
        if (trimmed) {
          const parts = trimmed.split('**')
          if (parts.length > 1) {
            return (
              <p key={idx} className="text-sm leading-relaxed text-[#6f6a61]">
                {parts.map((part, i) =>
                  i % 2 === 1 ? (
                    <strong key={i} className="font-bold text-neutral-950">
                      {part}
                    </strong>
                  ) : (
                    part
                  )
                )}
              </p>
            )
          }
          return (
            <p key={idx} className="text-sm leading-relaxed text-[#6f6a61]">
              {trimmed}
            </p>
          )
        }
        return <div key={idx} className="h-1" />
      })}
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[#ece9e0] bg-[#fffdf8] px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#9a8d82]">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-neutral-950" title={value}>
        {value || '-'}
      </p>
    </div>
  )
}
