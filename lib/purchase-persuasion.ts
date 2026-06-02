import type { OpenAI } from 'openai'
import type { BrandUrlCollection } from './brand-url-collector'
import { getTextGenerationModel } from '../src/lib/ai/llmClient'
import {
  getOpenAIBaseURLHost,
  getOpenAIKeyFingerprint,
  logAiDiagnostic,
  readOpenAIError,
} from '../src/lib/ai/diagnostics'

export interface PurchasePersuasionContext {
  brand: {
    name: string
    category: string
    tone: string
    targetCustomer: string
    positioning: string
  }
  offer: {
    productName: string
    priceSignals: string[]
    discountSignals: string[]
    shippingSignals: string[]
    availabilitySignals: string[]
    ctaTexts: string[]
  }
  persuasion: {
    customerPainPoints: string[]
    desiredOutcomes: string[]
    differentiators: string[]
    concreteBenefits: string[]
    proofPoints: string[]
    trustSignals: string[]
    objections: string[]
    objectionAnswers: string[]
    useCases: string[]
    emotionalTriggers: string[]
  }
  contentAngles: {
    strongestHook: string
    comparisonAngle: string
    problemSolutionAngle: string
    checklistAngle: string
    socialProofAngle: string
    saveReason: string
  }
  visualSignals: {
    productImages: string[]
    mood: string
    avoidVisuals: string[]
  }
  sourceConfidence: {
    strongFacts: string[]
    weakAssumptions: string[]
    missingInfo: string[]
  }
}

export function buildFallbackPurchasePersuasion(
  collected: Pick<BrandUrlCollection, 'sourceText' | 'finalUrl'>
): PurchasePersuasionContext {
  const text = collected.sourceText.replace(/\s+/g, ' ').trim()
  const title = text.split(/[.!?\n]/)[0]?.slice(0, 60) || new URL(collected.finalUrl).hostname

  return {
    brand: {
      name: title,
      category: '',
      tone: '',
      targetCustomer: '',
      positioning: '',
    },
    offer: {
      productName: title,
      priceSignals: extractMatches(text, /(?:\d[\d,.]*\s*원|\d+%|무료배송|배송비|쿠폰|할인)/g, 8),
      discountSignals: extractMatches(text, /(?:쿠폰|할인|특가|이벤트|혜택|적립)/g, 8),
      shippingSignals: extractMatches(text, /(?:무료배송|배송|당일|익일|반품|교환)/g, 8),
      availabilitySignals: extractMatches(text, /(?:품절|재고|예약|한정|오늘|마감)/g, 8),
      ctaTexts: extractMatches(text, /(?:구매|장바구니|문의|상담|예약|자세히|보기|신청)/g, 8),
    },
    persuasion: {
      customerPainPoints: [],
      desiredOutcomes: [],
      differentiators: [],
      concreteBenefits: [],
      proofPoints: [],
      trustSignals: [],
      objections: [],
      objectionAnswers: [],
      useCases: [],
      emotionalTriggers: [],
    },
    contentAngles: {
      strongestHook: '구매 전 확인해야 할 핵심 차이를 먼저 보여주세요.',
      comparisonAngle: '비슷한 선택지와 비교해 달라지는 기준을 정리하세요.',
      problemSolutionAngle: '고객이 겪는 불편에서 시작해 상품의 해결 방식으로 연결하세요.',
      checklistAngle: '선택 전에 확인할 기준을 체크리스트로 요약하세요.',
      socialProofAngle: '확인된 리뷰, 판매처, 인증, 운영 정보만 근거로 사용하세요.',
      saveReason: '나중에 구매 전 다시 볼 수 있는 선택 기준을 담으세요.',
    },
    visualSignals: {
      productImages: [],
      mood: '',
      avoidVisuals: [],
    },
    sourceConfidence: {
      strongFacts: text ? [text.slice(0, 240)] : [],
      weakAssumptions: [],
      missingInfo: ['가격, 배송, 리뷰, 인증 정보가 명확하지 않으면 카드뉴스에서 단정하지 마세요.'],
    },
  }
}

export async function analyzePurchasePersuasionWithOpenAI(params: {
  openai: OpenAI
  collected: BrandUrlCollection
  locale?: string
}): Promise<PurchasePersuasionContext> {
  const isEn = params.locale === 'en'
  const fallback = buildFallbackPurchasePersuasion(params.collected)
  const prompt = `Analyze the scraped commerce/brand page and extract purchase persuasion information for SNS carousel card news.

Rules:
- Return valid JSON only.
- Separate verified facts from assumptions.
- Do not invent prices, discounts, ingredients, certifications, rankings, reviews, or performance claims.
- If a field is not present, use an empty string or empty array.
- ${isEn ? 'Write natural English values.' : 'Write natural Korean values.'}

[Collected URL]
Requested: ${params.collected.requestedUrl}
Final: ${params.collected.finalUrl}
Diagnostics: ${params.collected.diagnostics.join(', ')}

[Scraped Context]
${params.collected.promptContext.slice(0, 11000)}

Required JSON shape:
{
  "brand": {
    "name": "",
    "category": "",
    "tone": "",
    "targetCustomer": "",
    "positioning": ""
  },
  "offer": {
    "productName": "",
    "priceSignals": [],
    "discountSignals": [],
    "shippingSignals": [],
    "availabilitySignals": [],
    "ctaTexts": []
  },
  "persuasion": {
    "customerPainPoints": [],
    "desiredOutcomes": [],
    "differentiators": [],
    "concreteBenefits": [],
    "proofPoints": [],
    "trustSignals": [],
    "objections": [],
    "objectionAnswers": [],
    "useCases": [],
    "emotionalTriggers": []
  },
  "contentAngles": {
    "strongestHook": "",
    "comparisonAngle": "",
    "problemSolutionAngle": "",
    "checklistAngle": "",
    "socialProofAngle": "",
    "saveReason": ""
  },
  "visualSignals": {
    "productImages": [],
    "mood": "",
    "avoidVisuals": []
  },
  "sourceConfidence": {
    "strongFacts": [],
    "weakAssumptions": [],
    "missingInfo": []
  }
}`

  try {
    const model = getTextGenerationModel()
    const diagnosticContext = {
      stepName: 'purchase persuasion analysis',
      provider: 'openai' as const,
      model,
      baseURL: getOpenAIBaseURLHost(),
      keyFingerprint: getOpenAIKeyFingerprint(),
    }
    logAiDiagnostic({ status: 'start', ...diagnosticContext })
    const response = await params.openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You extract grounded purchase persuasion data for carousel copy. Return JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 1800,
    })
    const raw = response.choices[0]?.message?.content
    if (!raw) {
      logAiDiagnostic({
        status: 'fallback',
        ...diagnosticContext,
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
        errorMessage: 'empty response',
      })
      return fallback
    }
    logAiDiagnostic({
      status: 'success',
      ...diagnosticContext,
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
      totalTokens: response.usage?.total_tokens,
    })
    return normalizePurchasePersuasion(JSON.parse(raw), fallback)
  } catch (error) {
    console.warn('[PurchasePersuasion] analysis failed, using fallback', error)
    logAiDiagnostic({
      status: 'failure',
      stepName: 'purchase persuasion analysis',
      provider: 'openai',
      model: getTextGenerationModel(),
      baseURL: getOpenAIBaseURLHost(),
      keyFingerprint: getOpenAIKeyFingerprint(),
      ...readOpenAIError(error),
    })
    return fallback
  }
}

export function formatPurchasePersuasionForPrompt(context: PurchasePersuasionContext): string {
  return [
    '[Purchase Persuasion Context]',
    `Brand: ${context.brand.name} / ${context.brand.category} / ${context.brand.positioning}`,
    `Product: ${context.offer.productName}`,
    `Price/discount/shipping: ${[
      ...context.offer.priceSignals,
      ...context.offer.discountSignals,
      ...context.offer.shippingSignals,
    ].slice(0, 10).join(', ') || 'none verified'}`,
    `Pain points: ${context.persuasion.customerPainPoints.slice(0, 6).join(', ') || 'none verified'}`,
    `Benefits: ${context.persuasion.concreteBenefits.slice(0, 8).join(', ') || 'none verified'}`,
    `Differentiators: ${context.persuasion.differentiators.slice(0, 8).join(', ') || 'none verified'}`,
    `Proof/trust: ${[...context.persuasion.proofPoints, ...context.persuasion.trustSignals].slice(0, 8).join(', ') || 'none verified'}`,
    `Objections: ${context.persuasion.objections.slice(0, 6).join(', ') || 'none verified'}`,
    `Hook angle: ${context.contentAngles.strongestHook}`,
    `Comparison angle: ${context.contentAngles.comparisonAngle}`,
    `Save reason: ${context.contentAngles.saveReason}`,
    `Verified facts only: ${context.sourceConfidence.strongFacts.slice(0, 8).join(' / ') || 'none'}`,
    `Missing info: ${context.sourceConfidence.missingInfo.slice(0, 6).join(', ') || 'none'}`,
  ].join('\n').slice(0, 3500)
}

function normalizePurchasePersuasion(value: unknown, fallback: PurchasePersuasionContext): PurchasePersuasionContext {
  const object = isRecord(value) ? value : {}
  return {
    brand: {
      name: readString(object.brand, 'name') || fallback.brand.name,
      category: readString(object.brand, 'category'),
      tone: readString(object.brand, 'tone'),
      targetCustomer: readString(object.brand, 'targetCustomer'),
      positioning: readString(object.brand, 'positioning'),
    },
    offer: {
      productName: readString(object.offer, 'productName') || fallback.offer.productName,
      priceSignals: readArray(object.offer, 'priceSignals'),
      discountSignals: readArray(object.offer, 'discountSignals'),
      shippingSignals: readArray(object.offer, 'shippingSignals'),
      availabilitySignals: readArray(object.offer, 'availabilitySignals'),
      ctaTexts: readArray(object.offer, 'ctaTexts'),
    },
    persuasion: {
      customerPainPoints: readArray(object.persuasion, 'customerPainPoints'),
      desiredOutcomes: readArray(object.persuasion, 'desiredOutcomes'),
      differentiators: readArray(object.persuasion, 'differentiators'),
      concreteBenefits: readArray(object.persuasion, 'concreteBenefits'),
      proofPoints: readArray(object.persuasion, 'proofPoints'),
      trustSignals: readArray(object.persuasion, 'trustSignals'),
      objections: readArray(object.persuasion, 'objections'),
      objectionAnswers: readArray(object.persuasion, 'objectionAnswers'),
      useCases: readArray(object.persuasion, 'useCases'),
      emotionalTriggers: readArray(object.persuasion, 'emotionalTriggers'),
    },
    contentAngles: {
      strongestHook: readString(object.contentAngles, 'strongestHook') || fallback.contentAngles.strongestHook,
      comparisonAngle: readString(object.contentAngles, 'comparisonAngle'),
      problemSolutionAngle: readString(object.contentAngles, 'problemSolutionAngle'),
      checklistAngle: readString(object.contentAngles, 'checklistAngle'),
      socialProofAngle: readString(object.contentAngles, 'socialProofAngle'),
      saveReason: readString(object.contentAngles, 'saveReason') || fallback.contentAngles.saveReason,
    },
    visualSignals: {
      productImages: readArray(object.visualSignals, 'productImages'),
      mood: readString(object.visualSignals, 'mood'),
      avoidVisuals: readArray(object.visualSignals, 'avoidVisuals'),
    },
    sourceConfidence: {
      strongFacts: readArray(object.sourceConfidence, 'strongFacts'),
      weakAssumptions: readArray(object.sourceConfidence, 'weakAssumptions'),
      missingInfo: readArray(object.sourceConfidence, 'missingInfo'),
    },
  }
}

function readString(parent: unknown, key: string) {
  if (!isRecord(parent)) return ''
  const value = parent[key]
  return typeof value === 'string' ? value.trim() : ''
}

function readArray(parent: unknown, key: string) {
  if (!isRecord(parent)) return []
  const value = parent[key]
  if (!Array.isArray(value)) return []
  return value.map(item => String(item).trim()).filter(Boolean).slice(0, 12)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function extractMatches(text: string, pattern: RegExp, limit: number) {
  return Array.from(new Set(text.match(pattern) || [])).slice(0, limit)
}
