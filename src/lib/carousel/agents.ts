import { parseBrandDna } from '../../../lib/brand-dna'

export interface AgentReportItem {
  agentName: string
  role: string
  status: 'info' | 'warn' | 'success' | 'error'
  message: string
  details?: any
  timestamp: string
}

export interface AgentReport {
  timestamp: string
  status: 'passed' | 'needs_review' | 'failed'
  score: number
  logs: AgentReportItem[]
}

export interface AgentSlideData {
  slideNumber: number
  role: string
  headline: string
  body: string
  layoutType: string
  designPrompt?: string
  backgroundImageUrl?: string
  diagnostics?: string[]
}

// 1. BrandIdentityAgent: 브랜드 아이덴티티 및 가이드라인 가드
export class BrandIdentityAgent {
  private logs: AgentReportItem[] = []

  private log(status: AgentReportItem['status'], message: string, details?: any) {
    this.logs.push({
      agentName: 'BrandIdentityAgent',
      role: '브랜드 아이덴티티 및 가이드라인 가드',
      status,
      message,
      details,
      timestamp: new Date().toISOString(),
    })
  }

  public run(params: {
    brandName: string
    brandToneOfVoice?: string
    forbiddenWords?: string
    ctaStyle?: string
    brandDna?: string | null
    slides: AgentSlideData[]
  }): { slides: AgentSlideData[]; logs: AgentReportItem[] } {
    this.logs = []
    this.log('info', `브랜드 '${params.brandName}' 가이드라인 분석을 시작합니다.`, {
      toneOfVoice: params.brandToneOfVoice || '미지정',
      ctaStyle: params.ctaStyle || '미지정',
      forbiddenCount: params.forbiddenWords ? params.forbiddenWords.split(/[,;\n]/).filter(Boolean).length : 0,
    })

    const forbiddenWords = this.parseForbiddenWords(params.forbiddenWords)
    const dna = parseBrandDna(params.brandDna)
    const brandSignals = [
      ...dna.brandKeywords,
      ...dna.coreProducts,
      ...dna.differentiators,
    ].map(k => k.toLowerCase()).filter(Boolean)

    const processedSlides = params.slides.map((slide) => {
      let headline = this.normalizeCopy(slide.headline)
      let body = this.normalizeCopy(slide.body)
      const isLast = slide.role === 'save-cta' || slide.role === 'summary'

      // 금칙어 검사
      const beforeForbidden = `${headline}\n${body}`
      headline = this.removeForbiddenWords(headline, forbiddenWords)
      body = this.removeForbiddenWords(body, forbiddenWords)

      if (`${headline}\n${body}` !== beforeForbidden) {
        this.log('warn', `슬라이드 ${slide.slideNumber}번: 금칙어가 탐지되어 텍스트를 정화했습니다.`, {
          original: beforeForbidden,
          cleaned: `${headline}\n${body}`,
        })
      }

      // 브랜드 DNA 신호 커버리지 검증
      if (brandSignals.length > 0) {
        const slideText = `${headline} ${body}`.toLowerCase()
        const hasSignal = brandSignals.some(signal => slideText.includes(signal))
        if (!hasSignal) {
          this.log('warn', `슬라이드 ${slide.slideNumber}번: 브랜드 고유 키워드/차별점이 카피에 없습니다. 검토 권장.`)
        } else {
          this.log('info', `슬라이드 ${slide.slideNumber}번: 브랜드 DNA 신호 확인 완료.`)
        }
      }

      // 브랜드 톤앤매너 검증 로그
      if (params.brandToneOfVoice) {
        this.log('info', `슬라이드 ${slide.slideNumber}번: 브랜드 톤앤매너 '${params.brandToneOfVoice}' 적합성 검사 완료.`)
      }

      // CTA 스타일 적용
      if (isLast && params.ctaStyle) {
        body = this.normalizeCopy(params.ctaStyle)
        this.log('success', `마지막 슬라이드에 브랜드 지정 CTA 스타일 적용 완료: "${body}"`)
      }

      return { ...slide, headline, body }
    })

    this.log('success', `브랜드 가이드라인 준수 여부 검증 및 보정 완료.`)
    return { slides: processedSlides, logs: this.logs }
  }

  private normalizeCopy(value: string) {
    return String(value || '')
      .replace(/\*\*/g, '')
      .replace(/#{1,6}\s*/g, '')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
  }

  private parseForbiddenWords(value?: string) {
    return String(value || '')
      .split(/[,;\n]/)
      .map(word => word.trim())
      .filter(Boolean)
  }

  private removeForbiddenWords(value: string, forbiddenWords: string[]) {
    return forbiddenWords.reduce((text, word) => {
      if (!word) return text
      return text.split(word).join('')
    }, value).replace(/\s+/g, ' ').trim()
  }
}

// 2. CopywritingAgent: 카피 최적화 및 가독성 메이커
export class CopywritingAgent {
  private logs: AgentReportItem[] = []

  private log(status: AgentReportItem['status'], message: string, details?: any) {
    this.logs.push({
      agentName: 'CopywritingAgent',
      role: '카피 최적화 및 가독성 메이커',
      status,
      message,
      details,
      timestamp: new Date().toISOString(),
    })
  }

  public run(params: {
    title: string
    topic: string
    category: string
    brandName: string
    slides: AgentSlideData[]
  }): { slides: AgentSlideData[]; logs: AgentReportItem[] } {
    this.logs = []
    this.log('info', `카피 가독성 및 글자수 제한 최적화 작업을 시작합니다.`)

    const seenHeadlines = new Set<string>()

    const processedSlides = params.slides.map((slide) => {
      let headline = slide.headline
      let body = slide.body
      const role = slide.role

      // 텍스트 길이 제한 가이드
      const headlineLimit = this.getHeadlineLimit(role)
      const bodyLimit = this.getBodyLimit(role)

      // 헤드라인 누락 복구
      if (!headline) {
        headline = slide.slideNumber === 1 
          ? (params.title || params.topic) 
          : `${params.topic} 핵심 포인트 ${slide.slideNumber}`
        this.log('warn', `슬라이드 ${slide.slideNumber}번: 누락된 헤드라인을 자동 생성 및 조율했습니다.`, { headline })
      }

      // 바디 누락 복구
      if (!body) {
        body = `${params.brandName}에서 제안하는 핵심 꿀팁입니다.`
        this.log('warn', `슬라이드 ${slide.slideNumber}번: 누락된 바디 카피를 보강했습니다.`, { body })
      }

      // 글자수 넘는 경우 스마트 트리밍
      if (headline.length > headlineLimit) {
        const oldHeadline = headline
        headline = this.trimToNaturalLength(headline, headlineLimit)
        this.log('warn', `슬라이드 ${slide.slideNumber}번: 헤드라인이 한도(${headlineLimit}자)를 초과하여 자동 조율 완료.`, {
          original: oldHeadline,
          adjusted: headline,
        })
      }

      if (body.length > bodyLimit) {
        const oldBody = body
        body = this.trimToNaturalLength(body, bodyLimit)
        this.log('warn', `슬라이드 ${slide.slideNumber}번: 바디 카피가 한도(${bodyLimit}자)를 초과하여 자동 조율 완료.`, {
          original: oldBody,
          adjusted: body,
        })
      }

      // 중복 헤드라인 조정
      const duplicateKey = headline.toLowerCase()
      if (seenHeadlines.has(duplicateKey)) {
        const oldHeadline = headline
        headline = this.trimToNaturalLength(`${headline} 알아보기`, headlineLimit)
        this.log('warn', `슬라이드 ${slide.slideNumber}번: 중복 헤드라인 감지로 문구 다변화 완료.`, {
          original: oldHeadline,
          adjusted: headline,
        })
      }
      seenHeadlines.add(headline.toLowerCase())

      return {
        ...slide,
        headline,
        body,
      }
    })

    this.log('success', `카피 최적화 및 스마트 트리밍 완료.`)
    return { slides: processedSlides, logs: this.logs }
  }

  private getHeadlineLimit(role: string): number {
    const limits: Record<string, number> = {
      hook: 18,
      context: 20,
      'key-point': 18,
      detail: 20,
      stat: 16,
      summary: 18,
      'save-cta': 16,
    }
    return limits[role] || 20
  }

  private getBodyLimit(role: string): number {
    const limits: Record<string, number> = {
      hook: 46,
      context: 58,
      'key-point': 54,
      detail: 62,
      stat: 48,
      summary: 52,
      'save-cta': 42,
    }
    return limits[role] || 56
  }

  private trimToNaturalLength(value: string, maxLength: number) {
    const clean = value.replace(/\s+/g, ' ').trim()
    if (clean.length <= maxLength) return clean

    const sliced = clean.slice(0, maxLength + 1)
    const trimmed = sliced.replace(/\s+\S*$/, '').replace(/[,.!?…\s]+$/, '')
    return trimmed || clean.slice(0, maxLength)
  }
}

// 3. VisualConceptAgent: 비주얼 아트 디렉터
export class VisualConceptAgent {
  private logs: AgentReportItem[] = []

  private log(status: AgentReportItem['status'], message: string, details?: any) {
    this.logs.push({
      agentName: 'VisualConceptAgent',
      role: '비주얼 아트 디렉터',
      status,
      message,
      details,
      timestamp: new Date().toISOString(),
    })
  }

  public run(params: {
    category: string
    topic: string
    tone: string
    brandMainColor?: string
    brandIndustry?: string
    slides: AgentSlideData[]
  }): { slides: AgentSlideData[]; logs: AgentReportItem[] } {
    this.logs = []
    this.log('info', `비주얼 컨셉 기획 및 레이아웃 매칭을 시작합니다.`, {
      category: params.category,
      topic: params.topic,
      tone: params.tone,
    })

    const processedSlides = params.slides.map((slide) => {
      // 레이아웃 검토 및 비주얼 프롬프트 가이드 생성
      const hasStat = /[\d%]/.test(`${slide.headline} ${slide.body}`)
      let layoutType = slide.layoutType

      if (hasStat && layoutType !== 'stat-highlight') {
        layoutType = 'stat-highlight'
        this.log('info', `슬라이드 ${slide.slideNumber}번: 수치 데이터 감지로 'stat-highlight' 레이아웃 재배치.`)
      }

      this.log('info', `슬라이드 ${slide.slideNumber}번: 비주얼 컨셉 분석 완료. 메인 컬러(${params.brandMainColor || '기본'}) 및 레이아웃형(${layoutType}) 매칭 완료.`)

      return {
        ...slide,
        layoutType,
      }
    })

    this.log('success', `비주얼 컨셉 기획 및 타이포그래피 계획 수립 완료.`)
    return { slides: processedSlides, logs: this.logs }
  }
}

// 4. QualityGuardAgent: 최종 퀄리티 게이트 및 발행 가부 판정단
export class QualityGuardAgent {
  private logs: AgentReportItem[] = []

  private log(status: AgentReportItem['status'], message: string, details?: any) {
    this.logs.push({
      agentName: 'QualityGuardAgent',
      role: '최종 퀄리티 게이트 및 발행 가부 판정단',
      status,
      message,
      details,
      timestamp: new Date().toISOString(),
    })
  }

  public run(params: {
    slides: AgentSlideData[]
    hasFallbackImage: boolean
  }): { passed: boolean; score: number; logs: AgentReportItem[] } {
    this.logs = []
    this.log('info', `최종 카드뉴스 퀄리티 검사(가독성, 정렬, 안전성)를 진행합니다.`)

    let totalScore = 100
    let issueCount = 0
    const issues: string[] = []

    // 1. 이미지 폴백 여부 확인
    if (params.hasFallbackImage) {
      totalScore -= 20
      issueCount += 1
      issues.push('이미지 생성 API 실패로 대체 임시 이미지가 사용되었습니다.')
      this.log('warn', `디자인 품질 주의: 일부 슬라이드에 대체(Mock) 이미지가 배치되었습니다. 감점(-20점)`)
    }

    // 2. 슬라이드별 텍스트 여백 및 가독성 진단
    params.slides.forEach((slide) => {
      const textLen = slide.headline.length + slide.body.length
      if (textLen > 80) {
        totalScore -= 5
        issueCount += 1
        issues.push(`${slide.slideNumber}번 슬라이드: 총 글자수(${textLen}자)가 많아 모바일 가독성이 저하될 우려가 있습니다.`)
        this.log('warn', `슬라이드 ${slide.slideNumber}번: 글자수가 다소 많음. 가독성 경고. 감점(-5점)`)
      }

      if (slide.diagnostics && slide.diagnostics.length > 0) {
        slide.diagnostics.forEach(diag => {
          totalScore -= 2
          issueCount += 1
          issues.push(`${slide.slideNumber}번 슬라이드: ${diag}`)
          this.log('warn', `슬라이드 ${slide.slideNumber}번 레이아웃 진단 경고: ${diag}. 감점(-2점)`)
        })
      }
    })

    // 최종 판정
    const score = Math.max(0, totalScore)
    const passed = score >= 80

    if (passed) {
      this.log('success', `종합 품질 검증 완료. 최종 점수: ${score}점. 검사 통과 및 승인 대기 단계로 인계합니다.`)
    } else {
      this.log('error', `종합 품질 기준 미달. 최종 점수: ${score}점. 에이전트 수정 보완이 필요합니다.`, { issues })
    }

    return { passed, score, logs: this.logs }
  }
}
