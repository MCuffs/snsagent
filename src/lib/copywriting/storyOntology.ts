import type { EditorialDirectorPlan, EditorialSlideRole } from '../editorial/editorialDirector'

export interface StoryOntologyNode {
  id: string
  slideNumber: number
  role: EditorialSlideRole
  concept: string
  question: string
  mustInclude: string[]
  avoid: string[]
  transitionToNext: string
}

export interface StoryOntology {
  subject: string
  promise: string
  nodes: StoryOntologyNode[]
}

const ROLE_ONTOLOGY: Record<EditorialSlideRole, {
  concept: string
  question: string
  mustInclude: string[]
  transition: string
}> = {
  hook: {
    concept: 'reader-tension',
    question: 'Why should this topic matter right now?',
    mustInclude: ['one concrete object or situation', 'a reason to swipe'],
    transition: 'Open a question the next slide can answer.',
  },
  context: {
    concept: 'real-life-context',
    question: 'Where does the reader actually encounter this topic?',
    mustInclude: ['daily use scene', 'reader pain or curiosity'],
    transition: 'Move from the situation to the decision point.',
  },
  'key-point': {
    concept: 'decision-criterion',
    question: 'What should the reader pay attention to first?',
    mustInclude: ['specific criterion', 'why it changes the decision'],
    transition: 'Prepare a concrete explanation or example.',
  },
  detail: {
    concept: 'concrete-evidence',
    question: 'What detail makes the claim believable?',
    mustInclude: ['feature, ingredient, texture, method, or usage detail', 'reader benefit'],
    transition: 'Connect the detail to proof or a practical takeaway.',
  },
  stat: {
    concept: 'grounded-proof',
    question: 'What source-backed fact supports the story?',
    mustInclude: ['only verified fact or cautious phrasing', 'what the fact means for the reader'],
    transition: 'Turn proof into a memorable summary.',
  },
  summary: {
    concept: 'meaningful-takeaway',
    question: 'What should the reader remember after swiping?',
    mustInclude: ['one distilled takeaway', 'one concrete reminder'],
    transition: 'Lead naturally into saving, checking, or buying.',
  },
  'save-cta': {
    concept: 'next-action',
    question: 'What should the reader do with this information?',
    mustInclude: ['specific action', 'reason to save or check details'],
    transition: 'Close the story without adding a new claim.',
  },
}

const GENERIC_AVOID = [
  'abstract filler such as 생활 속 선택, 핵심 기준, 반복되는 상황',
  'repeating the previous slide in different words',
  'unsupported health, discount, ranking, review, or certification claims',
]

export function buildStoryOntology(params: {
  topic: string
  category: string
  sourceMaterial: string
  editorialPlan: EditorialDirectorPlan
}): StoryOntology {
  const subject = extractSubject(params.topic)
  const concreteSignals = extractConcreteSignals(params.sourceMaterial, params.topic, params.category)
  const nodes = params.editorialPlan.slides.map((slide, index) => {
    const base = ROLE_ONTOLOGY[slide.role]
    const next = params.editorialPlan.slides[index + 1]
    return {
      id: `${slide.slideNumber}-${base.concept}`,
      slideNumber: slide.slideNumber,
      role: slide.role,
      concept: `${subject}:${base.concept}`,
      question: base.question,
      mustInclude: unique([
        ...base.mustInclude,
        concreteSignals[index % Math.max(concreteSignals.length, 1)] || subject,
      ]).slice(0, 4),
      avoid: GENERIC_AVOID,
      transitionToNext: next
        ? `${base.transition} Next node is ${ROLE_ONTOLOGY[next.role].concept}.`
        : base.transition,
    }
  })

  return {
    subject,
    promise: `${subject} 주제를 추상적으로 설명하지 않고, 상황-기준-근거-행동으로 이어지는 하나의 이야기로 만든다.`,
    nodes,
  }
}

export function formatStoryOntologyForPrompt(ontology: StoryOntology) {
  return [
    'STORY ONTOLOGY (mandatory; every body must follow this graph):',
    `Subject: ${ontology.subject}`,
    `Story promise: ${ontology.promise}`,
    ...ontology.nodes.map(node => [
      `Slide ${node.slideNumber} [${node.role}] node=${node.concept}`,
      `  - guiding question: ${node.question}`,
      `  - must include: ${node.mustInclude.join(' / ')}`,
      `  - transition: ${node.transitionToNext}`,
      `  - avoid: ${node.avoid.join(' / ')}`,
    ].join('\n')),
    'Rule: each slide must answer its own guiding question and hand off to the next node. Do not write standalone generic summaries.',
  ].join('\n')
}

export function getStoryNode(ontology: StoryOntology, slideNumber: number) {
  return ontology.nodes.find(node => node.slideNumber === slideNumber)
}

function extractSubject(topic: string) {
  return topic
    .replace(/추천|효능|장점|카드뉴스|콘텐츠|본문|소개|후킹/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || topic.trim() || '주제'
}

function extractConcreteSignals(sourceMaterial: string, topic: string, category: string) {
  const text = `${topic}\n${category}\n${sourceMaterial}`
  const foodSignals = [
    /호두|견과|아몬드|캐슈|피스타치오/g,
    /불포화지방산|오메가|지방산|단백질|식이섬유|항산화/g,
    /고소|식감|포만감|간식|샐러드|아침|토핑/g,
  ].flatMap(pattern => text.match(pattern) || [])

  const numericSignals = text.match(/\d[\d,.]*\s*(?:%|원|개|g|kg|ml|회|일|시간|분)?/g) || []
  const nounSignals = text
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 2 && token.length <= 12)
    .filter(token => !/카드뉴스|콘텐츠|브랜드|정보|추천|효능|기준|선택/.test(token))
    .slice(0, 12)

  return unique([...foodSignals, ...numericSignals, ...nounSignals, topic, category]).slice(0, 12)
}

function unique(items: string[]) {
  return Array.from(new Set(items.map(item => item.trim()).filter(Boolean)))
}
