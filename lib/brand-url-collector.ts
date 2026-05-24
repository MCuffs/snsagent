export interface BrandUrlCollection {
  requestedUrl: string
  finalUrl: string
  status: number
  promptContext: string
  sourceText: string
  diagnostics: string[]
}

interface FetchCandidate {
  url: string
  label: string
}

const USER_AGENTS = {
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
}

export async function collectBrandUrlContext(url: string, options?: { isNaverStore?: boolean }): Promise<BrandUrlCollection> {
  const candidates = buildUrlCandidates(url, options?.isNaverStore)
  const diagnostics: string[] = []
  let lastError: unknown = null

  for (const candidate of candidates) {
    try {
      const response = await fetchHtml(candidate.url, options?.isNaverStore)
      diagnostics.push(`${candidate.label}: HTTP ${response.status}`)
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`)
        continue
      }

      const html = await response.text()
      const extracted = extractBrandSignals(html, response.url || candidate.url)
      if (extracted.sourceText.length < 50) {
        lastError = new Error('Not enough readable text')
        diagnostics.push(`${candidate.label}: readable text too short (${extracted.sourceText.length})`)
        continue
      }

      return {
        requestedUrl: url,
        finalUrl: response.url || candidate.url,
        status: response.status,
        promptContext: buildPromptContext({
          requestedUrl: url,
          finalUrl: response.url || candidate.url,
          ...extracted,
          diagnostics: diagnostics.concat(extracted.diagnostics),
        }),
        sourceText: extracted.sourceText,
        diagnostics: diagnostics.concat(extracted.diagnostics),
      }
    } catch (error) {
      lastError = error
      diagnostics.push(`${candidate.label}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  throw new Error(`웹사이트를 읽지 못했습니다. ${diagnostics.join(' | ') || getErrorMessage(lastError)}`)
}

export function extractBrandSignals(html: string, finalUrl: string) {
  const withoutNoise = html.replace(/<(script|style|svg|noscript|iframe|canvas)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  const metadata = extractMetadata(html)
  const structuredData = extractJsonLd(html)
  const headings = extractTaggedText(withoutNoise, ['h1', 'h2', 'h3']).slice(0, 30)
  const imageSignals = extractImageSignals(html, finalUrl).slice(0, 24)
  const linkSignals = extractAnchors(withoutNoise).slice(0, 30)
  const bodyBlocks = extractBodyBlocks(withoutNoise).slice(0, 70)
  const sourceText = compactText([
    metadata.title,
    metadata.description,
    metadata.ogTitle,
    metadata.ogDescription,
    structuredData.join('\n'),
    headings.join('\n'),
    imageSignals.map(item => `${item.alt} ${item.src}`).join('\n'),
    bodyBlocks.join('\n'),
  ].filter(Boolean).join('\n')).slice(0, 12000)

  return {
    metadata,
    structuredData,
    headings,
    imageSignals,
    linkSignals,
    bodyBlocks,
    sourceText,
    diagnostics: [
      `metadata=${Object.values(metadata).filter(Boolean).length}`,
      `jsonLd=${structuredData.length}`,
      `headings=${headings.length}`,
      `images=${imageSignals.length}`,
      `bodyBlocks=${bodyBlocks.length}`,
    ],
  }
}

function buildUrlCandidates(url: string, isNaverStore?: boolean): FetchCandidate[] {
  const candidates: FetchCandidate[] = [{ url, label: 'original' }]
  try {
    const parsed = new URL(url)
    if (isNaverStore && parsed.hostname.includes('smartstore.naver.com')) {
      candidates.unshift({
        url: url.replace('smartstore.naver.com', 'm.smartstore.naver.com'),
        label: 'naver mobile',
      })
    }
    if (parsed.hostname.startsWith('www.')) {
      const noWww = new URL(url)
      noWww.hostname = noWww.hostname.replace(/^www\./, '')
      candidates.push({ url: noWww.toString(), label: 'non-www' })
    } else {
      const withWww = new URL(url)
      withWww.hostname = `www.${withWww.hostname}`
      candidates.push({ url: withWww.toString(), label: 'www' })
    }
  } catch {
    return candidates
  }

  return dedupeBy(candidates, item => item.url)
}

async function fetchHtml(url: string, isNaverStore?: boolean) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 12000)
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        Referer: isNaverStore ? 'https://m.search.naver.com/' : new URL(url).origin,
        'User-Agent': isNaverStore ? USER_AGENTS.mobile : USER_AGENTS.desktop,
      },
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

function extractMetadata(html: string) {
  return {
    title: decodeHtml((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim()),
    description: findMeta(html, 'name', 'description'),
    keywords: findMeta(html, 'name', 'keywords'),
    ogTitle: findMeta(html, 'property', 'og:title'),
    ogDescription: findMeta(html, 'property', 'og:description'),
    ogSiteName: findMeta(html, 'property', 'og:site_name'),
    ogImage: absolutize(findMeta(html, 'property', 'og:image'), html),
    twitterTitle: findMeta(html, 'name', 'twitter:title'),
    twitterDescription: findMeta(html, 'name', 'twitter:description'),
    canonical: decodeHtml(findLink(html, 'canonical')),
  }
}

function findMeta(html: string, attr: 'name' | 'property', key: string) {
  const metaRegex = /<meta\b[^>]*>/gi
  const tags = html.match(metaRegex) || []
  for (const tag of tags) {
    const attrValue = readAttr(tag, attr)
    if (attrValue?.toLowerCase() === key.toLowerCase()) return decodeHtml(readAttr(tag, 'content') || '')
  }
  return ''
}

function findLink(html: string, rel: string) {
  const linkRegex = /<link\b[^>]*>/gi
  const tags = html.match(linkRegex) || []
  for (const tag of tags) {
    if (readAttr(tag, 'rel')?.toLowerCase().split(/\s+/).includes(rel)) return readAttr(tag, 'href') || ''
  }
  return ''
}

function extractJsonLd(html: string) {
  const matches = Array.from(html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
  return matches
    .flatMap(match => flattenJsonLd(match[1]))
    .map(compactText)
    .filter(Boolean)
    .slice(0, 16)
}

function flattenJsonLd(raw: string): string[] {
  try {
    const parsed = JSON.parse(decodeHtml(raw.trim()))
    const nodes = Array.isArray(parsed) ? parsed : [parsed]
    return nodes.flatMap(node => summarizeJsonNode(node)).filter(Boolean)
  } catch {
    return [stripTags(raw).slice(0, 800)]
  }
}

function summarizeJsonNode(value: unknown): string[] {
  if (!value || typeof value !== 'object') return []
  const node = value as Record<string, unknown>
  const graph = Array.isArray(node['@graph']) ? node['@graph'].flatMap(summarizeJsonNode) : []
  const parts = [
    readJsonString(node['@type']),
    readJsonString(node.name),
    readJsonString(node.brand),
    readJsonString(node.description),
    readJsonString(node.category),
    readJsonString(node.sku),
    readJsonString(node.offers),
    readJsonString(node.aggregateRating),
  ].filter(Boolean)
  return parts.length ? [parts.join(' | '), ...graph] : graph
}

function extractTaggedText(html: string, tags: string[]) {
  return tags.flatMap(tag => {
    const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')
    return Array.from(html.matchAll(re)).map(match => cleanTextBlock(match[1]))
  }).filter(isUsefulText)
}

function extractImageSignals(html: string, finalUrl: string) {
  const imgTags = html.match(/<img\b[^>]*>/gi) || []
  return imgTags
    .map(tag => ({
      alt: decodeHtml(readAttr(tag, 'alt') || readAttr(tag, 'title') || ''),
      src: resolveUrl(readAttr(tag, 'src') || readAttr(tag, 'data-src') || readAttr(tag, 'data-original') || '', finalUrl),
    }))
    .filter(item => isUsefulText(item.alt) || /product|goods|item|shop|brand|cdn|smartstore|store/i.test(item.src))
}

function extractAnchors(html: string) {
  const matches = Array.from(html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi))
  return matches.map(match => cleanTextBlock(match[1])).filter(isUsefulText)
}

function extractBodyBlocks(html: string) {
  const preferred = extractTaggedText(html, ['h1', 'h2', 'h3', 'p', 'li', 'strong', 'em', 'button'])
  const fallback = stripTags(html)
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map(cleanTextBlock)
    .filter(isUsefulText)

  return rankTextBlocks(dedupeBy(preferred.concat(fallback), item => item.toLowerCase()))
}

function rankTextBlocks(blocks: string[]) {
  return blocks
    .map(text => ({ text, score: scoreTextBlock(text) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.text)
}

function scoreTextBlock(text: string) {
  let score = Math.min(text.length, 240)
  if (/상품|제품|브랜드|스토어|구매|혜택|리뷰|배송|예약|문의|클래스|서비스|솔루션|가격|세트|추천|특징|효과|성분|사이즈|product|brand|shop|store|service|review|benefit/i.test(text)) score += 120
  if (/로그인|회원가입|장바구니|개인정보|이용약관|copyright|사업자|고객센터|전체메뉴|검색|닫기|열기/i.test(text)) score -= 120
  if (/^[\d\s.,:/()-]+$/.test(text)) score -= 100
  return score
}

function buildPromptContext(input: ReturnType<typeof extractBrandSignals> & {
  requestedUrl: string
  finalUrl: string
  diagnostics: string[]
}) {
  const meta = input.metadata
  return [
    '[Collection Diagnostics]',
    `Requested URL: ${input.requestedUrl}`,
    `Final URL: ${input.finalUrl}`,
    `Signals: ${input.diagnostics.join(', ')}`,
    '',
    '[Page Metadata]',
    compactText([
      `title: ${meta.title}`,
      `description: ${meta.description}`,
      `keywords: ${meta.keywords}`,
      `og:title: ${meta.ogTitle}`,
      `og:description: ${meta.ogDescription}`,
      `og:site_name: ${meta.ogSiteName}`,
      `og:image: ${meta.ogImage}`,
      `twitter:title: ${meta.twitterTitle}`,
      `twitter:description: ${meta.twitterDescription}`,
      `canonical: ${meta.canonical}`,
    ].filter(line => !line.endsWith(': ')).join('\n')),
    '',
    '[Structured Data JSON-LD]',
    input.structuredData.join('\n').slice(0, 2500) || 'none',
    '',
    '[Headings]',
    input.headings.join('\n').slice(0, 1800) || 'none',
    '',
    '[Image And Product Visual Signals]',
    input.imageSignals.map(item => `alt="${item.alt}" src="${item.src}"`).join('\n').slice(0, 2200) || 'none',
    '',
    '[Navigation And Category Signals]',
    input.linkSignals.join('\n').slice(0, 1600) || 'none',
    '',
    '[Important Body Text]',
    input.bodyBlocks.join('\n').slice(0, 5000) || 'none',
  ].join('\n').slice(0, 12000)
}

function readAttr(tag: string, attr: string) {
  const safeAttr = attr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = tag.match(new RegExp(`${safeAttr}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`, 'i'))
  return match ? decodeHtml(match[2] || match[3] || match[4] || '') : ''
}

function readJsonString(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(readJsonString).filter(Boolean).join(', ')
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>
    return [object.name, object.description, object.price, object.priceCurrency, object.ratingValue]
      .map(readJsonString)
      .filter(Boolean)
      .join(' ')
  }
  return ''
}

function cleanTextBlock(value: string) {
  return compactText(stripTags(value))
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, ' '))
}

function compactText(value: string) {
  return decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isUsefulText(value: string) {
  const text = compactText(value)
  return text.length >= 2 && text.length <= 500 && !/^[|·•\s\d.,:/\\()[\]{}_-]+$/.test(text)
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
}

function resolveUrl(value: string, baseUrl: string) {
  if (!value) return ''
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return value
  }
}

function absolutize(value: string, html: string) {
  if (!value) return ''
  const canonical = findLink(html, 'canonical')
  return canonical ? resolveUrl(value, canonical) : value
}

function dedupeBy<T>(items: T[], keyFn: (item: T) => string) {
  const seen = new Set<string>()
  return items.filter(item => {
    const key = keyFn(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'unknown error')
}
