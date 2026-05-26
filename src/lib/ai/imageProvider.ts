export interface ImageProvider {
  generateImage(
    prompt: string,
    options?: {
      size?: string
      productImageUrls?: string[]
    }
  ): Promise<{ imageUrl: string }>
}

export function sanitizeImagePrompt(prompt: string): string {
  if (!prompt) return ''

  let sanitized = prompt

  // 1. Strip quoted text
  sanitized = sanitized.replace(/"[^"]*"/g, ' ')
  sanitized = sanitized.replace(/'[^']*'/g, ' ')
  sanitized = sanitized.replace(/“[^”]*”/g, ' ')
  sanitized = sanitized.replace(/‘[^’]*’/g, ' ')

  // 2. Strip Korean characters (Hangul)
  sanitized = sanitized.replace(/[\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\ud7b0-\ud7ff]+/g, ' ')

  const forbiddenWords = [
    'text',
    'headline',
    'caption',
    'title',
    'words',
    'letters',
    'typography',
    'signage',
    'sign',
    'poster',
    'menu',
    'label',
    'logo',
    'watermark',
    'ui',
    'writing',
    'calligraphy',
    'handwriting',
    '문구',
    '제목',
    '텍스트',
    '카피'
  ]

  // Split into clauses by comma, period, or semicolon
  const clauses = sanitized.split(/([,.;\n]+)/)
  const processedClauses = clauses.map(clause => {
    if (/^[,.;\n]+$/.test(clause)) return clause
    
    const trimmed = clause.trim()
    if (!trimmed) return ''

    // Check if it contains any forbidden word
    const containingWord = forbiddenWords.find(word => trimmed.toLowerCase().includes(word))
    if (containingWord) {
      // Check if it is a negative instruction context
      const isNegative = /^(no|without|never|avoid|empty|clean|do\s+not|don't|free|blank|ignore|never\s+render)\b/i.test(trimmed) || 
                         /\b(no|without|never|avoid|empty|clean|free|blank)\b/i.test(trimmed)
      
      if (!isNegative) {
        return ''
      }
    }
    return clause
  })

  sanitized = processedClauses.join('')

  // 3. Enforce background only if not already present
  if (!sanitized.toLowerCase().includes('background only') && !sanitized.toLowerCase().includes('no text')) {
    sanitized = `${sanitized}, clean background only, no text`
  }

  // Clean up whitespace and duplicate commas
  sanitized = sanitized
    .replace(/\s+/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/^,\s*/, '')
    .replace(/,\s*$/, '')
    .trim()

  return sanitized
}

export function isPromptAllowed(prompt: string): boolean {
  if (!prompt) return true
  const lowercasePrompt = prompt.toLowerCase()
  
  const forbiddenWords = [
    'text',
    'headline',
    'caption',
    'title',
    'words',
    'letters',
    'korean typography',
    'typography',
    '문구',
    '제목',
    '텍스트',
    '카피'
  ]

  if (!forbiddenWords.some(word => lowercasePrompt.includes(word))) {
    return true
  }

  const clauses = lowercasePrompt.split(/[,.;\n]+/)
  
  for (const clause of clauses) {
    const trimmed = clause.trim()
    if (!trimmed) continue
    
    const containingWord = forbiddenWords.find(word => trimmed.includes(word))
    if (containingWord) {
      const isNegative = /^(no|without|never|avoid|empty|clean|do\s+not|don't|free|blank|ignore|never\s+render)\b/i.test(trimmed) || 
                         /\b(no|without|never|avoid|empty|clean|free|blank)\b/i.test(trimmed)
      
      if (!isNegative) {
        return false
      }
    }
  }

  return true
}
