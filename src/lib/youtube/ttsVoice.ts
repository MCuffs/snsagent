export const YOUTUBE_TTS_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const

export type YouTubeTtsVoice = typeof YOUTUBE_TTS_VOICES[number]

export function pickRandomTtsVoice(): YouTubeTtsVoice {
  return YOUTUBE_TTS_VOICES[Math.floor(Math.random() * YOUTUBE_TTS_VOICES.length)]
}

// Projects created before the ttsVoice column existed have no stored voice.
// Derive one deterministically from the project id so their voice stays stable across renders.
export function resolveProjectTtsVoice(projectId: string, storedVoice?: string | null): YouTubeTtsVoice {
  if (storedVoice && (YOUTUBE_TTS_VOICES as readonly string[]).includes(storedVoice)) {
    return storedVoice as YouTubeTtsVoice
  }
  let hash = 0
  for (let i = 0; i < projectId.length; i += 1) {
    hash = (hash * 31 + projectId.charCodeAt(i)) >>> 0
  }
  return YOUTUBE_TTS_VOICES[hash % YOUTUBE_TTS_VOICES.length]
}
