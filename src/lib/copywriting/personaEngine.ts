import type { BrandProfile, CampaignInput } from '../carousel/types'
import {
  getPersonaProfiles,
  type PersonaId,
  type PersonaProfile,
} from './copyKnowledgeBase'

export function inferPersona(brand: BrandProfile, input: CampaignInput): PersonaProfile {
  const audience = (brand.targetAudience ?? '').toLowerCase()
  const objective = (input.objective ?? '').toLowerCase()
  const industry = (brand.industry ?? '').toLowerCase()
  const tone = (brand.toneOfVoice ?? '').toLowerCase()

  const scores: Record<PersonaId, number> = {
    practical_saver: 0,
    trend_curator: 0,
    informed_professional: 0,
    lifestyle_aspirant: 0,
    community_sharer: 0,
  }

  // Age signals
  if (/30대|육아|맘|주부|가성비|실용/.test(audience)) scores.practical_saver += 3
  if (/20대|학생|감성|무드|gen.?z/.test(audience)) scores.trend_curator += 3

  // Objective / content signals
  if (/정보|전문|b2b|비즈니스|리포트/.test(audience + objective)) scores.informed_professional += 3
  if (/라이프|자기개발|성장|루틴|습관/.test(audience + objective)) scores.lifestyle_aspirant += 3
  if (/커뮤니티|sns|인플루언서|공유|팬/.test(industry + audience)) scores.community_sharer += 3

  // Industry signals
  if (/ai|기술|saas|b2b|소프트웨어/.test(industry)) scores.informed_professional += 2
  if (/뷰티|패션|라이프스타일/.test(industry)) scores.trend_curator += 1
  if (/교육|학습|콘텐츠/.test(industry)) scores.community_sharer += 1

  // Tone-of-voice tie-break
  if (/감성|무드|감각/.test(tone)) scores.trend_curator += 1
  if (/전문|신뢰|정확|데이터/.test(tone)) scores.informed_professional += 1
  if (/응원|따뜻|친근/.test(tone)) scores.lifestyle_aspirant += 1

  const sorted = (Object.entries(scores) as [PersonaId, number][]).sort((a, b) => b[1] - a[1])
  const topId = sorted[0][0]

  const all = getPersonaProfiles()
  return all.find(p => p.id === topId) ?? all[0]
}

export function formatPersonaForPrompt(persona: PersonaProfile): string {
  const hints = persona.copyToneHints.slice(0, 2).join(', ')
  const triggers = persona.triggerWords.slice(0, 3).join(', ')
  const avoid = persona.avoidWords.slice(0, 3).join(', ')
  const result = `페르소나: ${persona.id} — ${persona.coreMotivation}. 어조: ${hints}. 반응 단어: ${triggers}. 금기: ${avoid}`
  return result.length > 180 ? result.slice(0, 177) + '...' : result
}

export function getPersonaById(id: PersonaId): PersonaProfile {
  const all = getPersonaProfiles()
  return all.find(p => p.id === id) ?? all[0]
}

export function getAllPersonas(): PersonaProfile[] {
  return getPersonaProfiles()
}
