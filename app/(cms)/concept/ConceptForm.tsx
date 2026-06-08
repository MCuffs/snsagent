'use client'

import { useState, useEffect, useRef } from 'react'
import { useTab } from '../TabContext'
import { AlertCircle, ArrowRight, CheckCircle2, Globe, Loader2, MessageCircle, Save, Send, Sparkles, X } from 'lucide-react'
import { analyzeBrandWebsiteAction, saveBrandAction } from '../../actions'
import { parseBrandDna, stringifyBrandDna } from '../../../lib/brand-dna'
import { motion, AnimatePresence } from 'framer-motion'
import { analytics } from '../../../lib/analytics/thinkingdata'
import { useTranslations, useLocale } from 'next-intl'

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
  websiteUrl?: string | null
}

interface ConceptFormProps {
  existingBrand: BrandData | null
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
}

const VISUAL_MOODS = [
  { id: 'minimal', label: 'Minimal', descKey: 'mood_minimal' },
  { id: 'dark-editorial', label: 'Dark Editorial', descKey: 'mood_dark_editorial' },
  { id: 'warm-lifestyle', label: 'Warm Lifestyle', descKey: 'mood_warm_lifestyle' },
  { id: 'bold-commerce', label: 'Bold Commerce', descKey: 'mood_bold_commerce' },
  { id: 'clean-pro', label: 'Clean Professional', descKey: 'mood_clean_pro' },
]

const analyzeSteps = (t: (key: string) => string) => [
  t('analyze_step1'),
  t('analyze_step2'),
  t('analyze_step3'),
  t('analyze_step4'),
]

export default function ConceptForm({ existingBrand }: ConceptFormProps) {
  const { setActiveTab } = useTab()
  const t = useTranslations('concept')
  const locale = useLocale()
  const steps = analyzeSteps(t)
  const [phase, setPhase] = useState<'url' | 'profile'>(
    existingBrand?.websiteUrl ? 'profile' : 'url'
  )
  const [brandId, setBrandId] = useState(existingBrand?.id || null)

  // URL phase state
  const [url, setUrl] = useState(existingBrand?.websiteUrl || '')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzeStep, setAnalyzeStep] = useState(0)

  // Profile fields
  const [name, setName] = useState(existingBrand?.name || '')
  const [industry, setIndustry] = useState(existingBrand?.industry || '')
  const [targetAudience, setTargetAudience] = useState(existingBrand?.targetAudience || '')
  const [toneOfVoice, setToneOfVoice] = useState(existingBrand?.toneOfVoice || '')
  const [mainColor, setMainColor] = useState(existingBrand?.mainColor || '#0066ff')
  const [forbiddenWords, setForbiddenWords] = useState(existingBrand?.forbiddenWords || '')
  const [ctaStyle, setCtaStyle] = useState(existingBrand?.ctaStyle || '')
  const [brandDna, setBrandDna] = useState(existingBrand?.brandDna || '')
  const [brandDescription, setBrandDescription] = useState(
    () => parseBrandDna(existingBrand?.brandDna).brandDescription
  )
  const [visualMood, setVisualMood] = useState('minimal')

  // Keep brandDescription in sync when brandDna changes externally (after analysis)
  const updateBrandDna = (newDna: string) => {
    setBrandDna(newDna)
    setBrandDescription(parseBrandDna(newDna).brandDescription)
  }

  const handleBrandDescriptionChange = (desc: string) => {
    setBrandDescription(desc)
    const parsed = parseBrandDna(brandDna)
    setBrandDna(stringifyBrandDna({ ...parsed, brandDescription: desc }))
  }

  // UI state
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [analysisReport, setAnalysisReport] = useState<string | null>(null)

  // AI chat panel
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatWaiting, setChatWaiting] = useState(false)
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'ai' | 'user'; content: string; id: string }>>([])
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isAnalyzing) {
      const interval = setInterval(() => {
        setAnalyzeStep((prev) => (prev < 3 ? prev + 1 : prev))
      }, 1500)
      return () => clearInterval(interval)
    }
  }, [isAnalyzing])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleChatSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = chatInput.trim()
    if (!text || chatWaiting || !brandId) return

    const msgId = `cm-${Date.now()}`
    const userMsg = { role: 'user' as const, content: text }
    setChatMessages(prev => [...prev, { role: 'user', content: text, id: msgId }])
    setChatHistory(prev => [...prev, userMsg])
    analytics.brandAiChatSend({
      brandId,
      messageLength: text.length,
      chatTurnIndex: chatHistory.filter(message => message.role === 'user').length + 1,
      locale,
    })
    setChatInput('')
    setChatWaiting(true)

    try {
      const newHistory = [...chatHistory, userMsg]
      const res = await fetch('/api/agents/brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory, brandId }),
      })
      const data = await res.json() as {
        message?: string
        updates?: {
          name?: string
          industry?: string
          targetAudience?: string
          toneOfVoice?: string
          mainColor?: string
          brandDescription?: string
        }
        error?: string
      }

      const aiText = data.message || t('error_unknown')
      setChatMessages(prev => [...prev, { role: 'ai', content: aiText, id: `cm-ai-${Date.now()}` }])
      setChatHistory(prev => [...prev, { role: 'assistant', content: aiText }])

      if (data.updates) {
        const u = data.updates
        if (u.name) setName(u.name)
        if (u.industry) setIndustry(u.industry)
        if (u.targetAudience) setTargetAudience(u.targetAudience)
        if (u.toneOfVoice) setToneOfVoice(u.toneOfVoice)
        if (u.mainColor) setMainColor(u.mainColor)
        if (u.brandDescription) handleBrandDescriptionChange(u.brandDescription)
      }
    } catch {
      setChatMessages(prev => [...prev, { role: 'ai', content: t('error_server'), id: `cm-err-${Date.now()}` }])
    } finally {
      setChatWaiting(false)
      chatInputRef.current?.focus()
    }
  }

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url) return
    analytics.brandCreateStart({
      brand_mode: url === 'general_profile' ? 'general' : 'brand',
      brand_url: url,
      locale,
    })
    setIsAnalyzing(true)
    setAnalyzeStep(0)
    setError(null)

    try {
      const res = await analyzeBrandWebsiteAction(url, locale)
      if (!res || !res.success) {
        analytics.brandUrlAnalyzed(url, false, { locale, reason: ('error' in (res ?? {})) ? (res as { error: string }).error : 'analyze_failed' })
        setError(('error' in (res ?? {})) ? (res as { error: string }).error : t('error_analyze_failed'))
        setIsAnalyzing(false)
        return
      }
      if (res.success && res.brandProfile) {
        analytics.brandUrlAnalyzed(url, true, { locale })
        const p = res.brandProfile
        setName(p.name)
        setIndustry(p.industry)
        setTargetAudience(p.targetAudience)
        setToneOfVoice(p.toneOfVoice)
        setMainColor(p.mainColor)
        setForbiddenWords(p.forbiddenWords)
        setCtaStyle(p.ctaStyle)
        updateBrandDna(p.brandDna || '')

        // 분석 결과 리포트 저장 (자동 저장 제거 — 사용자가 확인 후 저장 버튼 클릭)
        if (res.markdownReport) {
          setAnalysisReport(res.markdownReport)
        }
      }
    } catch {
      setError(t('error_network'))
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await saveBrandAction(brandId, {
        name,
        industry,
        targetAudience,
        toneOfVoice,
        mainColor,
        forbiddenWords,
        ctaStyle,
        brandDna: brandDna || null,
        websiteUrl: url || null,
      })
      if (res.success) {
        setBrandId(res.brand.id)
        analytics.brandCreateComplete(res.brand.id, {
          brand_mode: url === 'general_profile' ? 'general' : 'brand',
          industry,
          has_brand_dna: Boolean(brandDna),
          has_website_url: Boolean(url),
        })
        setSuccess(t('success_saved'))
      } else {
        setError(res.error || t('error_save'))
      }
    } catch {
      setError(t('error_save'))
    } finally {
      setIsSaving(false)
    }
  }

  // ── URL Phase ──────────────────────────────────────────────────
  if (phase === 'url') {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-6 py-16">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-lg"
        >
          <motion.div variants={itemVariants} className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#71717a]">Step 1 of 1</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#111111]">
              {t('url_title')}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#52525b]">
              {t('url_desc')}
            </p>
          </motion.div>

          {error && (
            <motion.div variants={itemVariants} className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </motion.div>
          )}

          <motion.form variants={itemVariants} onSubmit={handleAnalyze} className="space-y-4">
            <div className="relative">
              <Globe className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a1a1aa]" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isAnalyzing}
                required
                placeholder="https://smartstore.naver.com/..."
                className="h-12 w-full rounded-lg border border-[#e4e4e7] bg-white pl-11 pr-4 text-sm text-[#111111] placeholder-[#a1a1aa] outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/10 disabled:opacity-50"
              />
            </div>

            {isAnalyzing && (
              <div className="rounded-lg border border-[#e4e4e7] bg-[#fafafa] p-4">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-[#0066ff]">{steps[analyzeStep]}</span>
                  <span className="text-xs text-[#71717a]">{Math.round(((analyzeStep + 1) / 4) * 100)}%</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-[#e4e4e7]">
                  <div
                    className="h-full bg-[#0066ff] transition-all duration-1000 ease-out"
                    style={{ width: `${((analyzeStep + 1) / 4) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isAnalyzing || !url}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#111111] text-sm font-semibold text-white transition hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isAnalyzing ? t('analyzing') : t('analyze_btn')}
            </button>
          </motion.form>

          {/* 분석 완료 후 결과 + 저장 버튼 */}
          <AnimatePresence>
            {analysisReport && !isAnalyzing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.45, ease: [0.19, 1, 0.22, 1] }}
                className="mt-4 space-y-4 overflow-hidden"
              >
                <div className="rounded-lg border border-[#e4e4e7] bg-[#fafafa] overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-[#e4e4e7] bg-white">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs font-semibold text-[#111111]">{t('analysis_complete')}</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto p-4 text-xs leading-relaxed text-[#52525b] whitespace-pre-wrap">
                    {analysisReport}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setIsSaving(true)
                    setError(null)
                    const saved = await saveBrandAction(brandId, {
                      name, industry, targetAudience, toneOfVoice,
                      mainColor, forbiddenWords, ctaStyle,
                      brandDna: brandDna || null,
                      websiteUrl: url,
                    })
                    setIsSaving(false)
                    if (saved.success) {
                      setBrandId(saved.brand.id)
                      analytics.brandCreateComplete(saved.brand.id, {
                        brand_mode: url === 'general_profile' ? 'general' : 'brand',
                        industry,
                        has_brand_dna: Boolean(brandDna),
                        has_website_url: Boolean(url),
                      })
                      setPhase('profile')
                    } else {
                      setError(saved.error || t('error_save'))
                    }
                  }}
                  disabled={isSaving}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0066ff] text-sm font-semibold text-white transition hover:bg-[#0052cc] disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t('save_continue')}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {existingBrand && !analysisReport && (
            <motion.button
              variants={itemVariants}
              type="button"
              onClick={() => setPhase('profile')}
              className="mt-4 w-full text-center text-sm text-[#71717a] hover:text-[#111111] underline underline-offset-2 block"
            >
              {t('skip_to_profile')}
            </motion.button>
          )}
        </motion.div>
      </div>
    )
  }

  // ── Profile Phase ──────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">
      {/* Main form */}
      <div className="flex-1 overflow-y-auto">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="mx-auto max-w-2xl px-6 py-12"
      >
      <motion.div variants={itemVariants} className="mb-10 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#71717a]">Brand Concept</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#111111]">{t('profile_title')}</h1>
          <p className="mt-1.5 text-sm text-[#52525b]">{t('profile_desc')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPhase('url')}
            className="flex items-center gap-1.5 rounded-md border border-[#e4e4e7] bg-white px-3 py-1.5 text-xs font-medium text-[#52525b] hover:border-[#a1a1aa] transition-colors"
          >
            <Globe className="h-3.5 w-3.5" />
            {t('reanalyze')}
          </button>
          <button
            type="button"
            onClick={() => setChatOpen(prev => !prev)}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              chatOpen
                ? 'border-[#0066ff] bg-[#0066ff]/5 text-[#0066ff]'
                : 'border-[#e4e4e7] bg-white text-[#52525b] hover:border-[#a1a1aa]'
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {t('ai_chat_btn')}
          </button>
        </div>
      </motion.div>

      {error && (
        <motion.div variants={itemVariants} className="mb-6 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </motion.div>
      )}
      {success && (
        <motion.div variants={itemVariants} className="mb-6 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          {success}
        </motion.div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Store URL */}
        <Section title={t('section_url')}>
          <div className="relative">
            <Globe className="absolute left-3.5 top-3 h-4 w-4 text-[#a1a1aa]" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://smartstore.naver.com/..."
              className="h-11 w-full rounded-lg border border-[#e4e4e7] bg-white pl-10 pr-3 text-sm text-[#111111] placeholder-[#a1a1aa] outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/10"
            />
          </div>
        </Section>

        {/* Basic Info */}
        <Section title={t('section_basic')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('field_brand_name')} value={name} onChange={setName} placeholder={t('field_brand_name_placeholder')} required />
            <Field label={t('field_industry')} value={industry} onChange={setIndustry} placeholder={t('field_industry_placeholder')} required />
          </div>
          <div className="mt-4">
            <Field label={t('field_audience')} value={targetAudience} onChange={setTargetAudience} placeholder={t('field_audience_placeholder')} required />
          </div>
        </Section>

        {/* Brand Description */}
        <Section title={t('section_brand_desc')}>
          <label className="mb-1.5 block text-xs font-medium text-[#52525b]">Brand Description</label>
          <textarea
            value={brandDescription}
            onChange={(e) => handleBrandDescriptionChange(e.target.value)}
            placeholder={t('brand_desc_placeholder')}
            rows={4}
            className="w-full resize-none rounded-lg border border-[#e4e4e7] bg-white px-3.5 py-2.5 text-sm text-[#111111] placeholder-[#a1a1aa] outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/10"
          />
        </Section>

        {/* Visual Identity */}
        <Section title={t('section_visual')}>
          {/* Visual Mood */}
          <div className="mb-5">
            <label className="mb-2.5 block text-xs font-medium text-[#52525b]">{t('visual_mood')}</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {VISUAL_MOODS.map((mood) => (
                <button
                  key={mood.id}
                  type="button"
                  onClick={() => setVisualMood(mood.id)}
                  className={`rounded-lg border p-3 text-left transition-all ${
                    visualMood === mood.id
                      ? 'border-[#0066ff] bg-[#0066ff]/5 ring-1 ring-[#0066ff]'
                      : 'border-[#e4e4e7] bg-white hover:border-[#a1a1aa]'
                  }`}
                >
                  <p className="text-xs font-semibold text-[#111111]">{mood.label}</p>
                  <p className="mt-0.5 text-[10px] text-[#71717a] leading-4">{t(mood.descKey as Parameters<typeof t>[0])}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Brand Color */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#52525b]">{t('brand_color')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={mainColor}
                  onChange={(e) => setMainColor(e.target.value)}
                  placeholder="#0066ff"
                  className="h-11 flex-1 rounded-lg border border-[#e4e4e7] bg-white px-3.5 text-sm text-[#111111] placeholder-[#a1a1aa] outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/10"
                />
                <input
                  type="color"
                  value={mainColor.startsWith('#') && mainColor.length === 7 ? mainColor : '#0066ff'}
                  onChange={(e) => setMainColor(e.target.value)}
                  className="h-11 w-11 cursor-pointer rounded-lg border border-[#e4e4e7] p-1"
                  aria-label={t('color_picker')}
                />
              </div>
            </div>

            {/* Tone */}
            <Field
              label={t('field_tone')}
              value={toneOfVoice}
              onChange={setToneOfVoice}
              placeholder={t('field_tone_placeholder')}
              required
            />
          </div>
        </Section>

        {/* CTA & Forbidden */}
        <Section title={t('section_content')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('field_cta')}
              value={ctaStyle}
              onChange={setCtaStyle}
              placeholder={t('field_cta_placeholder')}
            />
            <Field
              label={t('field_forbidden')}
              value={forbiddenWords}
              onChange={setForbiddenWords}
              placeholder={t('field_forbidden_placeholder')}
            />
          </div>
        </Section>

        {/* Actions */}
        <motion.div variants={itemVariants} className="flex items-center gap-3 border-t border-[#e4e4e7] pt-6">
          <button
            type="submit"
            disabled={isSaving || !name}
            className="flex h-11 items-center gap-2 rounded-lg bg-[#111111] px-5 text-sm font-semibold text-white transition hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('save_btn')}
          </button>
          {brandId && (
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams(window.location.search)
                params.set('brandId', brandId)
                const newUrl = `${window.location.pathname}?${params.toString()}`
                window.history.pushState(null, '', newUrl)
                setActiveTab('generate')
              }}
              className="flex h-11 items-center gap-2 rounded-lg border border-[#e4e4e7] bg-white px-5 text-sm font-semibold text-[#111111] transition hover:border-[#a1a1aa] hover:bg-[#fafafa]"
            >
              {t('continue_btn')}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </motion.div>
      </form>
      </motion.div>
      </div>

      {/* AI Chat Panel */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 360, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.19, 1, 0.22, 1] }}
            className="flex shrink-0 flex-col border-l border-[#e4e4e7] bg-[#fafafa] overflow-hidden"
          >
            {/* Chat header */}
            <div className="flex shrink-0 items-center justify-between border-b border-[#e4e4e7] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0066ff] text-[10px] font-bold text-white">S</div>
                <span className="text-xs font-semibold text-[#111111]">{t('ai_panel_title')}</span>
              </div>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="rounded-md p-1 text-[#a1a1aa] transition hover:bg-[#e4e4e7] hover:text-[#111111]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {chatMessages.length === 0 && !chatWaiting && (
                <div className="rounded-xl rounded-tl-sm bg-[#f0f0f0] px-3.5 py-2.5 text-sm leading-5.5 text-[#111111]">
                  {t('ai_welcome')}
                </div>
              )}
              <AnimatePresence initial={false}>
                {chatMessages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-6 ${
                        msg.role === 'user'
                          ? 'rounded-tr-sm bg-[#111111] text-white'
                          : 'rounded-tl-sm bg-[#f0f0f0] text-[#111111]'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {chatWaiting && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="rounded-xl rounded-tl-sm bg-[#f0f0f0] px-4 py-3">
                    <div className="flex gap-1.5">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#a1a1aa]" style={{ animationDelay: '0ms' }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#a1a1aa]" style={{ animationDelay: '120ms' }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#a1a1aa]" style={{ animationDelay: '240ms' }} />
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-[#e4e4e7] bg-white px-3 py-3">
              {!brandId && (
                <p className="mb-2 text-[11px] text-[#a1a1aa]">{t('ai_no_brand')}</p>
              )}
              <form onSubmit={handleChatSend} className="flex items-center gap-2">
                <input
                  ref={chatInputRef}
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={chatWaiting || !brandId}
                  placeholder={brandId ? t('chat_placeholder') : t('chat_placeholder_no_brand')}
                  className="h-10 flex-1 rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-3.5 text-sm text-[#111111] placeholder-[#a1a1aa] outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/10 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || chatWaiting || !brandId}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111111] text-white transition hover:bg-[#333333] disabled:opacity-30"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div variants={itemVariants}>
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#71717a]">{title}</h2>
      {children}
    </motion.div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  required?: boolean
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#52525b]">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="h-11 w-full rounded-lg border border-[#e4e4e7] bg-white px-3.5 text-sm text-[#111111] placeholder-[#a1a1aa] outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/10"
      />
    </div>
  )
}
