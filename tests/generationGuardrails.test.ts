import assert from 'node:assert/strict'
import test from 'node:test'
import { articleMatchesTopic, extractGenerationKeywords } from '../src/lib/rss/rssFetcher.ts'
import { evaluateSemanticCopy } from '../src/lib/copywriting/semanticCopyCritic.ts'
import { getDomainProfileForText } from '../src/lib/content/domainProfile.ts'

test('RSS matching rejects unrelated breaking news for celebrity diet topic', () => {
  const topic = '연예인 식단 트렌드를 일반인 기준으로 쉽게 풀어 실전 적용 포인트를 전달'
  const keywords = extractGenerationKeywords(topic, ['저장형 카드뉴스'])

  assert.equal(
    articleMatchesTopic({
      title: 'SF 영화가 현실 될까, 하루 1400t 폭격 가능한 우주 무기 매스 드라이버',
      description: '우주 무기 기술을 설명하는 최신 과학 뉴스',
      link: 'https://example.com/space-weapon',
      pubDate: 'Mon, 08 Jun 2026 00:00:00 GMT',
    }, keywords, topic),
    false
  )
})

test('RSS matching keeps diet-related articles for celebrity diet topic', () => {
  const topic = '연예인 식단 트렌드를 일반인 기준으로 쉽게 풀어 실전 적용 포인트를 전달'
  const keywords = extractGenerationKeywords(topic, ['저장형 카드뉴스'])

  assert.equal(
    articleMatchesTopic({
      title: '50세 안 믿기는 배우 몸매, 하루 여섯 번 나눠 먹는 관리 식단',
      description: '단백질과 채소 중심 식사 루틴을 소개했다',
      link: 'https://example.com/celebrity-diet',
      pubDate: 'Mon, 08 Jun 2026 00:00:00 GMT',
    }, keywords, topic),
    true
  )
})

test('semantic guard blocks broken Korean bodies and off-topic sensational hooks', () => {
  const topic = '연예인 식단 트렌드를 일반인 기준으로 쉽게 풀어 실전 적용 포인트를 전달'
  const report = evaluateSemanticCopy({
    topic,
    language: 'ko',
    domainProfile: getDomainProfileForText(topic),
    slides: [
      {
        slideNumber: 1,
        role: 'hook',
        headline: '셀럽 식단, 폭격하듯 베끼지 마',
        body: '촬영용 식단은 일상 루틴과 다릅니다. 일반인은 식사 구성과 지속 가능성을 먼저 봐야 합니다.',
      },
      {
        slideNumber: 2,
        role: 'detail',
        headline: '칼로리보다 먼저 볼 것',
        body: '에서 일반인이 먼저 가져올 건 총량 집착이 아니라 식사 구성입니다.',
      },
      {
        slideNumber: 3,
        role: 'detail',
        headline: '끊지 말고 바꿔 먹기',
        body: '을 그대로 복붙하면 비용도 시간도 버티기 어렵습니다.',
      },
    ],
  })

  assert.equal(report.passed, false)
  assert.ok(report.issues.some(issue => issue.slideNumber === 1 && issue.severity === 'block'))
  assert.ok(report.issues.some(issue => issue.slideNumber === 2 && issue.severity === 'block'))
  assert.ok(report.issues.some(issue => issue.slideNumber === 3 && issue.severity === 'block'))
})
