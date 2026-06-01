/**
 * Truncates copy at a natural sentence or word boundary.
 * This avoids cutting a Korean particle, word, or clause in the middle.
 */
export function truncateAtSentenceBoundary(text: string, maxChars: number): string {
  const t = text.trim()
  if (t.length <= maxChars) return t

  const window = t.slice(0, maxChars)
  const sentenceEndPattern = /[.!?。！？]+|(?:습니다|합니다|됩니다|입니다|주세요|보세요|하세요|좋습니다|중요합니다|필요합니다|가능합니다|분명합니다|이어집니다|낮아집니다|높아집니다|있습니다|없습니다|같습니다|해집니다|줍니다|듭니다|납니다)(?=\s|$)/g
  let lastEnd = -1
  let match: RegExpExecArray | null

  while ((match = sentenceEndPattern.exec(window)) !== null) {
    lastEnd = match.index + match[0].length
  }

  if (lastEnd > maxChars * 0.4) {
    return t.slice(0, lastEnd).trim()
  }

  const lastSpace = window.lastIndexOf(' ')
  if (lastSpace > maxChars * 0.5) {
    return t.slice(0, lastSpace).trim()
  }

  return window.trim().replace(/[,，、;:]\s*$/, '')
}
