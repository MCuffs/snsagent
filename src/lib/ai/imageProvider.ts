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

  const unquoted = prompt
    .replace(/"[^"]*"/g, ' ')
    .replace(/'[^']*'/g, ' ')
    .replace(/“[^”]*”/g, ' ')
    .replace(/‘[^’]*’/g, ' ')

  const sanitized = unquoted
    .split(/\n+|,\s+|;\s+/)
    .map(line => line.trim())
    .filter(line => line && !requestsRenderedTypography(line))
    .join('\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return sanitized || 'BACKGROUND-ONLY PHOTOGRAPH.'
}

export function isPromptAllowed(prompt: string): boolean {
  return !prompt.split(/\n+|,\s+|;\s+/).some(line => requestsRenderedTypography(line))
}

function requestsRenderedTypography(line: string) {
  const normalized = line.toLowerCase()
  const isConstraint = /\b(no|without|avoid|blank|empty|background-only|background only|later|reserved|reserve|application|app-rendered|out of focus)\b/i.test(normalized)
    || /(금지|제외|비워|배경만|나중|앱에서)/.test(line)
  if (isConstraint) return false

  const visualText = /\b(text|headline|caption|title|letters?|typography|logo|watermark|label|signage|button|ui)\b/i.test(normalized)
    || /(텍스트|문구|제목|카피|로고|워터마크|버튼)/.test(line)
  const renderAction = /\b(add|render|write|display|show|include|insert|overlay|place|print|feature)\b/i.test(normalized)
    || /(넣|표시|작성|삽입|합성|보여)/.test(line)

  return visualText && renderAction
}
