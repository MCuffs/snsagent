import { getLightClient } from '../ai/llmClient'

export interface PlannerDay {
  dayNumber: number
  title: string
}

export interface YouTubeScenePlan {
  sceneNumber: number
  narration: string
  searchKeyword: string
  durationSeconds: number
}

export interface StockVideoCandidate {
  provider: 'pexels' | 'pixabay' | 'mock'
  id: string
  title: string
  videoUrl: string | null
  previewUrl: string | null
  sourceUrl: string | null
  keyword: string
}

export interface DayProductionPlan {
  script: string
  description: string
  tags: string[]
  pinnedComment: string
  scenes: YouTubeScenePlan[]
  sourceClips: StockVideoCandidate[]
  ttsProvider: string
  subtitles: Array<{ start: number; end: number; text: string }>
}

interface PlannerResponse {
  days: PlannerDay[]
}

interface DayPlanResponse {
  script: string
  description: string
  tags: string[]
  pinnedComment: string
  scenes: YouTubeScenePlan[]
}

export async function generateThirtyDayPlanner(topic: string, userId?: string): Promise<PlannerDay[]> {
  const cleanTopic = topic.trim().slice(0, 80)
  const fallback = () => ({
    days: Array.from({ length: 30 }, (_, index) => ({
      dayNumber: index + 1,
      title: buildFallbackTitle(cleanTopic, index + 1),
    })),
  })

  const prompt = [
    `주제: ${cleanTopic}`,
    '',
    '유튜브 쇼츠 채널용 30일 콘텐츠 캘린더를 만드세요.',
    '타겟은 유튜브 경험이 적은 40-60대 부업 희망자입니다.',
    '각 항목은 제목만 필요합니다.',
    '제목은 클릭하고 싶게 만들되 과장된 수익 보장, 의학/금융 확정 표현은 피하세요.',
    'JSON 형식: {"days":[{"dayNumber":1,"title":"..."}, ... 30개]}',
  ].join('\n')

  const result = await getLightClient().generateJson<PlannerResponse>(
    'youtube-automation-planner',
    prompt,
    fallback,
    {
      temperature: 0.7,
      diagnostics: { userId, metadata: { topic: cleanTopic } },
      systemPrompt: 'You are Shuffla YouTube Shorts content planner. Return valid JSON only.',
    },
  )

  return normalizePlannerDays(result.days, cleanTopic)
}

export async function generateDayProductionPlan(params: {
  topic: string
  title: string
  userId?: string
}): Promise<DayProductionPlan> {
  const fallback = () => buildFallbackDayPlan(params.topic, params.title)
  const prompt = [
    `채널 주제: ${params.topic}`,
    `오늘 제목: ${params.title}`,
    '',
    '45-60초 유튜브 쇼츠 제작안을 만드세요.',
    '무료 스톡 영상(Pexels/Pixabay)을 검색해 짜깁기할 수 있도록 장면별 영어 검색 키워드를 반드시 포함하세요.',
    '영상 생성 AI를 쓰지 않습니다. 기존 무료 영상을 잘라 붙이고, TTS 음성과 자막을 얹는 전제입니다.',
    '스크립트는 TTS로 읽기 쉽게 짧은 문장으로 작성하세요.',
    'JSON 형식:',
    '{"script":"...","description":"...","tags":["..."],"pinnedComment":"...","scenes":[{"sceneNumber":1,"narration":"...","searchKeyword":"english stock video keyword","durationSeconds":8}]}',
  ].join('\n')

  const result = await getLightClient().generateJson<DayPlanResponse>(
    'youtube-automation-day-plan',
    prompt,
    fallback,
    {
      temperature: 0.65,
      diagnostics: { userId: params.userId, metadata: { topic: params.topic, title: params.title } },
      systemPrompt: 'You are Shuffla YouTube Shorts producer. Return valid JSON only.',
    },
  )

  const scenes = normalizeScenes(result.scenes, result.script)
  const sourceClips = await collectStockVideoCandidates(scenes)
  return {
    script: String(result.script || fallback().script).trim(),
    description: String(result.description || fallback().description).trim(),
    tags: normalizeTags(result.tags, params.topic),
    pinnedComment: String(result.pinnedComment || '오늘 영상이 도움되셨다면 저장해두고 다시 확인해보세요.').trim(),
    scenes,
    sourceClips,
    ttsProvider: process.env.OPENAI_API_KEY ? 'openai-tts-ready' : 'tts-not-configured',
    subtitles: buildSubtitles(scenes),
  }
}

async function collectStockVideoCandidates(scenes: YouTubeScenePlan[]) {
  const results: StockVideoCandidate[] = []
  for (const scene of scenes.slice(0, 6)) {
    const candidates = await searchPexelsVideos(scene.searchKeyword, 2)
    if (candidates.length > 0) {
      results.push(...candidates.map(candidate => ({ ...candidate, keyword: scene.searchKeyword })))
      continue
    }

    const pixabay = await searchPixabayVideos(scene.searchKeyword, 2)
    if (pixabay.length > 0) {
      results.push(...pixabay.map(candidate => ({ ...candidate, keyword: scene.searchKeyword })))
      continue
    }

    results.push({
      provider: 'mock',
      id: `mock-${scene.sceneNumber}`,
      title: scene.searchKeyword,
      videoUrl: null,
      previewUrl: null,
      sourceUrl: null,
      keyword: scene.searchKeyword,
    })
  }
  return results
}

async function searchPexelsVideos(query: string, limit: number): Promise<Omit<StockVideoCandidate, 'keyword'>[]> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return []
  try {
    const params = new URLSearchParams({
      query,
      orientation: 'portrait',
      per_page: String(limit),
      size: 'medium',
    })
    const res = await fetch(`https://api.pexels.com/videos/search?${params.toString()}`, {
      headers: { Authorization: apiKey, 'User-Agent': 'Shuffla/1.0' },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return []
    const data = await res.json() as {
      videos?: Array<{
        id: number
        url?: string
        image?: string
        video_files?: Array<{ link?: string; quality?: string; width?: number; height?: number }>
      }>
    }
    return (data.videos || []).map(video => {
      const file = [...(video.video_files || [])]
        .filter(item => item.link)
        .sort((a, b) => scoreVideoFile(b) - scoreVideoFile(a))[0]
      return {
        provider: 'pexels' as const,
        id: String(video.id),
        title: query,
        videoUrl: file?.link || null,
        previewUrl: video.image || null,
        sourceUrl: video.url || null,
      }
    }).filter(item => item.videoUrl)
  } catch {
    return []
  }
}

async function searchPixabayVideos(query: string, limit: number): Promise<Omit<StockVideoCandidate, 'keyword'>[]> {
  const apiKey = process.env.PIXABAY_API_KEY
  if (!apiKey) return []
  try {
    const params = new URLSearchParams({
      key: apiKey,
      q: query.slice(0, 100),
      video_type: 'film',
      per_page: String(Math.min(200, Math.max(3, limit))),
      safesearch: 'true',
      order: 'popular',
    })
    const res = await fetch(`https://pixabay.com/api/videos/?${params.toString()}`, {
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return []
    const data = await res.json() as {
      hits?: Array<{
        id: number
        pageURL?: string
        videos?: { medium?: { url?: string; thumbnail?: string }, small?: { url?: string; thumbnail?: string } }
        tags?: string
      }>
    }
    return (data.hits || []).map(hit => {
      const video = hit.videos?.medium || hit.videos?.small
      return {
        provider: 'pixabay' as const,
        id: String(hit.id),
        title: hit.tags || query,
        videoUrl: video?.url || null,
        previewUrl: video?.thumbnail || null,
        sourceUrl: hit.pageURL || null,
      }
    }).filter(item => item.videoUrl)
  } catch {
    return []
  }
}

function normalizePlannerDays(days: PlannerDay[] | undefined, topic: string) {
  const source = Array.isArray(days) ? days : []
  const normalized = Array.from({ length: 30 }, (_, index) => {
    const candidate = source.find(day => Number(day.dayNumber) === index + 1) || source[index]
    return {
      dayNumber: index + 1,
      title: String(candidate?.title || buildFallbackTitle(topic, index + 1)).trim().slice(0, 80),
    }
  })
  return normalized
}

function normalizeScenes(scenes: YouTubeScenePlan[] | undefined, script: string) {
  const source = Array.isArray(scenes) ? scenes : []
  const fallbackLines = script.split(/[.!?\n]/).map(line => line.trim()).filter(Boolean)
  const normalized = source.length >= 3 ? source : fallbackLines.slice(0, 5).map((line, index) => ({
    sceneNumber: index + 1,
    narration: line,
    searchKeyword: `vertical ${line.split(/\s+/).slice(0, 4).join(' ')}`,
    durationSeconds: 8,
  }))
  return normalized.slice(0, 8).map((scene, index) => ({
    sceneNumber: index + 1,
    narration: String(scene.narration || '').trim().slice(0, 220),
    searchKeyword: sanitizeSearchKeyword(scene.searchKeyword),
    durationSeconds: Math.max(4, Math.min(12, Number(scene.durationSeconds) || 8)),
  })).filter(scene => scene.narration && scene.searchKeyword)
}

function normalizeTags(tags: unknown, topic: string) {
  const source = Array.isArray(tags) ? tags.map(String) : []
  const fallback = [topic, '쇼츠', '유튜브쇼츠', '정보', '부업']
  return Array.from(new Set([...source, ...fallback]))
    .map(tag => tag.replace(/^#/, '').trim())
    .filter(Boolean)
    .slice(0, 12)
}

function buildSubtitles(scenes: YouTubeScenePlan[]) {
  let cursor = 0
  return scenes.map(scene => {
    const start = cursor
    const end = cursor + scene.durationSeconds
    cursor = end
    return { start, end, text: scene.narration }
  })
}

function buildFallbackDayPlan(topic: string, title: string): DayPlanResponse {
  const scenes = [
    { sceneNumber: 1, narration: `${title}. 오늘은 이 주제를 아주 쉽게 정리해보겠습니다.`, searchKeyword: stockKeywordFor(topic, 'intro'), durationSeconds: 7 },
    { sceneNumber: 2, narration: '처음 시작할 때 가장 어려운 점은 무엇을 봐야 하는지 모른다는 것입니다.', searchKeyword: stockKeywordFor(topic, 'thinking person'), durationSeconds: 8 },
    { sceneNumber: 3, narration: '핵심은 작은 기준 하나를 정하고 매일 반복해서 확인하는 것입니다.', searchKeyword: stockKeywordFor(topic, 'daily routine'), durationSeconds: 9 },
    { sceneNumber: 4, narration: '오늘 내용은 저장해두고 필요할 때 다시 꺼내보세요.', searchKeyword: stockKeywordFor(topic, 'checklist'), durationSeconds: 7 },
  ]
  return {
    script: scenes.map(scene => scene.narration).join('\n'),
    description: `${title}\n\n${topic}에 관심 있는 분들을 위해 짧게 정리했습니다.`,
    tags: [topic, '쇼츠', '정보', '유튜브쇼츠'],
    pinnedComment: '내일도 이어서 볼 수 있게 저장해두세요.',
    scenes,
  }
}

function buildFallbackTitle(topic: string, day: number) {
  const patterns = [
    `${topic} 초보가 가장 먼저 알아야 할 3가지`,
    `${topic}을 매일 쉽게 시작하는 방법`,
    `${topic}에서 사람들이 자주 놓치는 포인트`,
    `${topic}을 오래 지속하는 작은 습관`,
    `${topic} 입문자가 피해야 할 실수`,
  ]
  return patterns[(day - 1) % patterns.length]
}

function sanitizeSearchKeyword(value: string) {
  const clean = String(value || '')
    .replace(/[#*_`"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return clean.length >= 3 ? clean.slice(0, 80) : 'vertical lifestyle b roll'
}

function stockKeywordFor(topic: string, suffix: string) {
  const hasKorean = /[가-힣]/.test(topic)
  if (!hasKorean) return `vertical ${topic} ${suffix}`
  if (/건강|운동|다이어트|식단/.test(topic)) return `vertical health ${suffix}`
  if (/경제|돈|투자|부업/.test(topic)) return `vertical business ${suffix}`
  if (/역사|명언|지식/.test(topic)) return `vertical education ${suffix}`
  return `vertical lifestyle ${suffix}`
}

function scoreVideoFile(file: { quality?: string; width?: number; height?: number }) {
  const ratio = file.width && file.height ? file.height / file.width : 0
  const portrait = ratio > 1.2 ? 20 : 0
  const quality = file.quality === 'hd' ? 10 : 0
  return portrait + quality + Math.min(10, Math.round((file.height || 0) / 200))
}
