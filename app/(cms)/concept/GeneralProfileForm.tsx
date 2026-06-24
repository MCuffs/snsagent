'use client'

import { useState } from 'react'
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Save, Sparkles } from 'lucide-react'
import { saveBrandAction } from '../../actions/brand'
import { analyzeGeneralProfileCoreWordAction } from '../../actions/brandCoreWord'
import { motion } from 'framer-motion'
import { useTranslations, useLocale } from 'next-intl'

interface ProfileData {
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

interface GeneralProfileFormProps {
  existingProfile: ProfileData | null
  onProfileSaved?: (profile: ProfileData) => void
  onContinueToGenerate?: (profile: ProfileData) => void
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

export default function GeneralProfileForm({
  existingProfile,
  onProfileSaved,
  onContinueToGenerate,
}: GeneralProfileFormProps) {
  const t = useTranslations('concept')
  const locale = useLocale()

  const [profileId, setProfileId] = useState(existingProfile?.id || null)

  // AI helper state
  const [coreWord, setCoreWord] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Form fields
  const [name, setName] = useState(existingProfile?.name || '')
  const [category, setCategory] = useState(existingProfile?.industry || 'current-affairs')
  const [keywords, setKeywords] = useState(existingProfile?.forbiddenWords || '')
  const [targetAudience, setTargetAudience] = useState(existingProfile?.targetAudience || '')
  const [toneOfVoice, setToneOfVoice] = useState(existingProfile?.toneOfVoice || '')
  const [mainColor, setMainColor] = useState(existingProfile?.mainColor || '#0f172a')

  // UI state
  const [isSaving, setIsSaving] = useState(false)
  const [isContinuing, setIsContinuing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const buildProfileData = (id: string): ProfileData => ({
    id,
    name,
    industry: category,
    targetAudience,
    toneOfVoice,
    mainColor,
    forbiddenWords: keywords,
    ctaStyle: '',
    brandDna: null,
    websiteUrl: 'general_profile',
  })

  const handleAnalyzeCoreWord = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!coreWord.trim() || isAnalyzing) return
    setIsAnalyzing(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await analyzeGeneralProfileCoreWordAction(coreWord.trim(), locale)
      if (res.success && res.profile) {
        const p = res.profile
        const validCategories = ['current-affairs', 'information', 'trends']
        const normalizedIndustry = validCategories.includes(p.industry) ? p.industry : 'current-affairs'
        setName(`${coreWord.trim()} 리포트`)
        setCategory(normalizedIndustry)
        setKeywords(p.forbiddenWords)
        setTargetAudience(p.targetAudience)
        setToneOfVoice(p.toneOfVoice)
        setMainColor(p.mainColor)
        setSuccess(t('ai_analyze_complete'))
      } else {
        const errMsg = !res.success && 'error' in res ? (res as { error: string }).error : null
        setError(errMsg || t('error_analyze_failed'))
      }
    } catch {
      setError(t('error_analyze_failed'))
    } finally {
      setIsAnalyzing(false)
    }
  }

  const saveProfile = async (showSuccess = true) => {
    setIsSaving(true)
    setError(null)
    if (showSuccess) setSuccess(null)

    try {
      const res = await saveBrandAction(profileId, {
        name,
        industry: category, // Save category to industry
        targetAudience,
        toneOfVoice,
        mainColor,
        forbiddenWords: keywords, // Save keywords to forbiddenWords
        ctaStyle: '', // CTA style is dynamically generated on campaign news generation
        brandDna: null,
        websiteUrl: 'general_profile', // Mark as general profile
      })
      if (res.success) {
        const savedProfile = buildProfileData(res.brand.id)
        setProfileId(savedProfile.id)
        onProfileSaved?.(savedProfile)
        if (showSuccess) setSuccess(t('success_saved'))
        return savedProfile
      } else {
        setError(res.error || t('error_save'))
      }
    } catch {
      setError(t('error_save'))
    } finally {
      setIsSaving(false)
    }
    return null
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    await saveProfile()
  }

  const handleContinue = async () => {
    if (!profileId || isContinuing || isSaving) return
    setIsContinuing(true)
    const savedProfile = await saveProfile(false)
    if (savedProfile) onContinueToGenerate?.(savedProfile)
    setIsContinuing(false)
  }

  return (
    <div className="relative isolate flex h-full overflow-y-auto bg-white">
      <ProfileAmbientBackdrop />
      <div className="relative z-10 flex-1">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-[920px] px-6 py-10"
        >
          <motion.div variants={itemVariants} className="mb-10">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#64748b]">General Profile</p>
            <h1 className="mt-2 text-[28px] font-black tracking-[-0.01em] text-[#111827]">
              {t('general_title')}
            </h1>
            <p className="mt-2 max-w-[560px] text-sm font-medium leading-6 text-[#64748b]">
              {t('general_desc')}
            </p>
          </motion.div>

          {/* Core Word AI discovery card */}
          <motion.div
            variants={itemVariants}
            className="mb-5 rounded-[24px] border border-[#dfe7ff] bg-white/76 p-5 shadow-[0_18px_48px_rgba(79,70,229,0.10)] backdrop-blur-xl"
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4.5 w-4.5 text-[#4252ff]" />
              <h3 className="text-sm font-bold text-[#111111]">{t('core_word')} AI 분석</h3>
            </div>
            <p className="text-xs text-[#52525b] mb-4 leading-relaxed">
              {t('core_word_hint')}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={coreWord}
                onChange={(e) => setCoreWord(e.target.value)}
                disabled={isAnalyzing}
                placeholder={t('core_word_placeholder')}
                className="h-11 flex-1 rounded-2xl border border-[#e5e7eb] bg-white/88 px-3.5 text-sm font-medium text-[#111111] placeholder-[#a8b0bd] outline-none transition-all focus:border-[#c4b5fd] focus:ring-2 focus:ring-[#4252ff]/10 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleAnalyzeCoreWord}
                disabled={isAnalyzing || !coreWord.trim()}
                className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#4252ff] px-4 text-xs font-bold text-white shadow-[0_12px_28px_rgba(66,82,255,0.22)] transition hover:bg-[#3442e8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {isAnalyzing ? t('ai_analyzing') : t('ai_analyze_btn')}
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

          <form onSubmit={handleSave} className="space-y-5">
            {/* Basic Info */}
            <Section title={t('section_basic')}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={t('profile_name')}
                  value={name}
                  onChange={setName}
                  placeholder={t('profile_name_placeholder')}
                  required
                />
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#52525b]">
                    {t('target_category')}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="h-11 w-full rounded-2xl border border-[#e5e7eb] bg-white/88 px-3 text-sm font-medium text-[#111111] outline-none transition-all focus:border-[#c4b5fd] focus:ring-2 focus:ring-[#4252ff]/10"
                  >
                    <option value="current-affairs">{t('category_current_affairs')}</option>
                    <option value="information">{t('category_information')}</option>
                    <option value="trends">{t('category_trends')}</option>
                  </select>
                </div>
              </div>
            </Section>

            {/* Keyword Setup */}
            <Section title={t('keywords')}>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#52525b]">{t('keywords')}</label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder={t('keywords_placeholder')}
                  required
                  className="h-11 w-full rounded-2xl border border-[#e5e7eb] bg-white/88 px-3.5 text-sm font-medium text-[#111111] placeholder-[#a8b0bd] outline-none transition-all focus:border-[#c4b5fd] focus:ring-2 focus:ring-[#4252ff]/10"
                />
                <p className="mt-1.5 text-[11px] leading-relaxed text-[#71717a]">{t('keywords_hint')}</p>
              </div>
            </Section>

            {/* Target Audience & Tone */}
            <Section title="Persona & Style">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={t('field_audience')}
                  value={targetAudience}
                  onChange={setTargetAudience}
                  placeholder={t('field_audience_placeholder')}
                  required
                />
                <Field
                  label={t('field_tone')}
                  value={toneOfVoice}
                  onChange={setToneOfVoice}
                  placeholder={t('field_tone_placeholder')}
                  required
                />
              </div>
            </Section>

            {/* Visual Identity */}
            <Section title={t('section_visual')}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#52525b]">{t('core_color')}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={mainColor}
                      onChange={(e) => setMainColor(e.target.value)}
                      placeholder="#0f172a"
                      className="h-11 flex-1 rounded-2xl border border-[#e5e7eb] bg-white/88 px-3.5 text-sm font-medium text-[#111111] placeholder-[#a8b0bd] outline-none transition-all focus:border-[#c4b5fd] focus:ring-2 focus:ring-[#4252ff]/10"
                    />
                    <input
                      type="color"
                      value={mainColor.startsWith('#') && mainColor.length === 7 ? mainColor : '#0f172a'}
                      onChange={(e) => setMainColor(e.target.value)}
                      className="h-11 w-11 cursor-pointer rounded-2xl border border-[#e5e7eb] bg-white/88 p-1"
                      aria-label={t('color_picker')}
                    />
                  </div>
                </div>
              </div>
            </Section>

            {/* Actions */}
            <motion.div variants={itemVariants} className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isSaving || !name}
                className="flex h-11 items-center gap-2 rounded-full bg-[#111827] px-5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(15,23,42,0.16)] transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t('save_btn')}
              </button>
              {profileId && (
                <motion.button
                  type="button"
                  onClick={handleContinue}
                  disabled={isContinuing}
                  whileTap={{ scale: 0.97 }}
                  animate={isContinuing ? { scale: [1, 0.98, 1] } : { scale: 1 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="relative flex h-11 items-center gap-2 overflow-hidden rounded-full border border-[#dfe7ff] bg-white/86 px-5 text-sm font-bold text-[#111827] shadow-sm backdrop-blur-xl transition hover:border-[#c7d2fe] hover:bg-[#f8fbff] hover:text-[#4252ff] disabled:cursor-wait disabled:border-[#4252ff]/40 disabled:bg-[#f5f7ff] disabled:text-[#4252ff]"
                >
                  {isContinuing && (
                    <motion.span
                      className="absolute inset-0 bg-[#0066ff]/8"
                      initial={{ x: '-100%' }}
                      animate={{ x: '100%' }}
                      transition={{ duration: 0.45, ease: 'easeInOut' }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    {isContinuing && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('generate_card_btn')}
                    {!isContinuing && <ArrowRight className="h-4 w-4" />}
                  </span>
                </motion.button>
              )}
            </motion.div>
          </form>
        </motion.div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div variants={itemVariants} className="rounded-[24px] border border-white/70 bg-white/76 p-5 shadow-[0_18px_48px_rgba(79,70,229,0.10)] backdrop-blur-xl">
      <h2 className="mb-4 text-xs font-black uppercase tracking-[0.14em] text-[#64748b]">{title}</h2>
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
      <label className="mb-1.5 block text-xs font-semibold text-[#52525b]">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="h-11 w-full rounded-2xl border border-[#e5e7eb] bg-white/88 px-3.5 text-sm font-medium text-[#111111] placeholder-[#a8b0bd] outline-none transition-all focus:border-[#c4b5fd] focus:ring-2 focus:ring-[#4252ff]/10"
      />
    </div>
  )
}

function ProfileAmbientBackdrop() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .shuffla-profile-ambient {
          background:
            radial-gradient(circle at 56% 36%, rgba(219, 234, 254, 0.44), transparent 34%),
            radial-gradient(circle at 82% 42%, rgba(237, 233, 254, 0.56), transparent 32%),
            radial-gradient(circle at 44% 54%, rgba(191, 219, 254, 0.28), transparent 30%),
            linear-gradient(180deg, #ffffff 0%, #fbfdff 58%, #ffffff 100%);
          background-size: 150% 150%;
          animation: shufflaProfileAmbientDrift 26s ease-in-out infinite alternate;
        }
        .shuffla-profile-ambient::after {
          content: "";
          position: absolute;
          inset: -18%;
          background:
            radial-gradient(circle at 46% 42%, rgba(96, 165, 250, 0.18), transparent 26%),
            radial-gradient(circle at 72% 48%, rgba(168, 85, 247, 0.16), transparent 30%);
          filter: blur(42px);
          animation: shufflaProfileAmbientFloat 34s ease-in-out infinite alternate;
        }
        @keyframes shufflaProfileAmbientDrift {
          0% { background-position: 0% 0%; transform: scale(1); }
          50% { background-position: 58% 38%; transform: scale(1.025); }
          100% { background-position: 100% 84%; transform: scale(1.045); }
        }
        @keyframes shufflaProfileAmbientFloat {
          0% { transform: translate3d(-2%, -1%, 0) rotate(0deg); opacity: 0.42; }
          100% { transform: translate3d(3%, 2%, 0) rotate(3deg); opacity: 0.58; }
        }
      ` }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 shuffla-profile-ambient" />
    </>
  )
}
