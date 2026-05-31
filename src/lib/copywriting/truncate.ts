/**
 * Truncates Korean copy at a natural sentence/clause boundary.
 * Never cuts mid-word or mid-clause — always ends at a complete thought.
 *
 * Priority order:
 * 1. Full text fits → return as-is
 * 2. Find last sentence-ending punctuation (. ! ? 요 다 죠 네 요.) within limit
 * 3. Fall back to last space within limit
 * 4. Hard slice only as last resort
 */
export function truncateAtSentenceBoundary(text: string, maxChars: number): string {
  const t = text.trim()
  if (t.length <= maxChars) return t

  const window = t.slice(0, maxChars)

  // Match Korean sentence-ending patterns and punctuation
  // Looks for: period, exclamation, question, or Korean endings (요, 다, 죠, 네, 요.)
  const sentenceEndPattern = /[.!?。！？]|(?<=[가-힣])[요다죠네]\s|(?<=[가-힣])[요다죠네]$/g
  let lastEnd = -1
  let match: RegExpExecArray | null

  while ((match = sentenceEndPattern.exec(window)) !== null) {
    lastEnd = match.index + match[0].length
  }

  if (lastEnd > maxChars * 0.4) {
    return t.slice(0, lastEnd).trim()
  }

  // Fallback: last space
  const lastSpace = window.lastIndexOf(' ')
  if (lastSpace > maxChars * 0.5) {
    return t.slice(0, lastSpace).trim()
  }

  // Last resort: hard slice (should rarely happen)
  return window.trim()
}
