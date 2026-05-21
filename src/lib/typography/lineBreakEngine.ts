const PARTICLES = [
  '은', '는', '이', '가', '을', '를', '의', '에', '에서', '으로', '로',
  '와', '과', '도', '만', '하고', '이랑', '랑', '에게', '한테', '이며',
  '고', '며', '면', '서', '니', '까', '서'
]

/**
 * 한국어 조사 및 어미 결합 규칙을 기반으로, 텍스트가 임의의 글자 수 경계에서 잘리지 않고
 * 자연스러운 의미 단위(어절/조사 그룹)로 줄바꿈되도록 개행 배열을 반환하는 엔진입니다.
 */
export function breakKoreanLines(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = text.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean)
  const groupedPhrases: string[] = []
  
  // 조사 결합: 단어가 조사로 시작하거나 이전 단어와 결합되어야 하는 경우 병합
  let temp = ''
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    
    // 현재 단어가 단순 조사이거나, 조사로만 시작하는 경우 이전 단어와 결합
    const isParticleOnly = PARTICLES.includes(word)
    
    if (temp && (isParticleOnly || i === 0)) {
      temp = `${temp} ${word}`
    } else {
      if (temp) {
        groupedPhrases.push(temp)
      }
      temp = word
    }
  }
  if (temp) {
    groupedPhrases.push(temp)
  }

  const lines: string[] = []
  let currentLine = ''

  for (const phrase of groupedPhrases) {
    const nextLine = currentLine ? `${currentLine} ${phrase}` : phrase
    
    // 개행 경계 체크
    if (currentLine && nextLine.length > maxCharsPerLine && lines.length < maxLines - 1) {
      lines.push(currentLine)
      currentLine = phrase
    } else {
      currentLine = nextLine
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines.slice(0, maxLines)
}
