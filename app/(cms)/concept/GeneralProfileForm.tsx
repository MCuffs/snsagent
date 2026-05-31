'use client'

import { useState } from 'react'
import { useTab } from '../TabContext'
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Save } from 'lucide-react'
import { saveBrandAction } from '../../actions'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'

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

export default function GeneralProfileForm({ existingProfile }: GeneralProfileFormProps) {
  const { setActiveTab } = useTab()
  const t = useTranslations('concept')

  const [profileId, setProfileId] = useState(existingProfile?.id || null)

  // Form fields
  const [name, setName] = useState(existingProfile?.name || '')
  const [category, setCategory] = useState(existingProfile?.industry || 'current-affairs')
  const [keywords, setKeywords] = useState(existingProfile?.forbiddenWords || '')
  const [targetAudience, setTargetAudience] = useState(existingProfile?.targetAudience || '')
  const [toneOfVoice, setToneOfVoice] = useState(existingProfile?.toneOfVoice || '')
  const [mainColor, setMainColor] = useState(existingProfile?.mainColor || '#0f172a')
  const [ctaStyle, setCtaStyle] = useState(existingProfile?.ctaStyle || '')

  // UI state
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await saveBrandAction(profileId, {
        name,
        industry: category, // Save category to industry
        targetAudience,
        toneOfVoice,
        mainColor,
        forbiddenWords: keywords, // Save keywords to forbiddenWords
        ctaStyle,
        brandDna: null,
        websiteUrl: 'general_profile', // Mark as general profile
      })
      if (res.success) {
        setProfileId(res.brand.id)
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

  const handleContinue = () => {
    if (profileId) {
      const params = new URLSearchParams(window.location.search)
      params.set('brandId', profileId)
      const newUrl = `${window.location.pathname}?${params.toString()}`
      window.history.pushState(null, '', newUrl)
      setActiveTab('generate')
    }
  }

  return (
    <div className="flex h-full overflow-y-auto">
      <div className="flex-1">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-2xl px-6 py-12"
        >
          <motion.div variants={itemVariants} className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#71717a]">General Profile</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#111111]">
              {t('general_title')}
            </h1>
            <p className="mt-1.5 text-sm text-[#52525b]">
              {t('general_desc')}
            </p>
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
                    className="h-11 w-full rounded-lg border border-[#e4e4e7] bg-white px-3 text-sm text-[#111111] outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/10"
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
                  className="h-11 w-full rounded-lg border border-[#e4e4e7] bg-white px-3.5 text-sm text-[#111111] placeholder-[#a1a1aa] outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/10"
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
                  <label className="mb-1.5 block text-xs font-medium text-[#52525b]">{t('brand_color')}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={mainColor}
                      onChange={(e) => setMainColor(e.target.value)}
                      placeholder="#0f172a"
                      className="h-11 flex-1 rounded-lg border border-[#e4e4e7] bg-white px-3.5 text-sm text-[#111111] placeholder-[#a1a1aa] outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/10"
                    />
                    <input
                      type="color"
                      value={mainColor.startsWith('#') && mainColor.length === 7 ? mainColor : '#0f172a'}
                      onChange={(e) => setMainColor(e.target.value)}
                      className="h-11 w-11 cursor-pointer rounded-lg border border-[#e4e4e7] p-1"
                      aria-label={t('color_picker')}
                    />
                  </div>
                </div>
                <Field
                  label={t('field_cta')}
                  value={ctaStyle}
                  onChange={setCtaStyle}
                  placeholder={t('field_cta_placeholder')}
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
              {profileId && (
                <button
                  type="button"
                  onClick={handleContinue}
                  className="flex h-11 items-center gap-2 rounded-lg border border-[#e4e4e7] bg-white px-5 text-sm font-semibold text-[#111111] transition hover:border-[#a1a1aa] hover:bg-[#fafafa]"
                >
                  {t('generate_card_btn')}
                  <ArrowRight className="h-4 w-4" />
                </button>
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
