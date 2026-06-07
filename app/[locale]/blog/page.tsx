import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Sparkles } from 'lucide-react'
import { MarketingNav } from '../../components/MarketingNav'
import { MarketingFooter } from '../../components/MarketingFooter'
import { getSessionUser } from '../../../lib/auth/user'
import { getBlogPosts } from '../../../lib/blog-posts'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isEn = locale === 'en'
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'

  return {
    title: isEn ? 'Blog | Shuffla Card News Studio' : '블로그 | Shuffla 카드뉴스 스튜디오',
    description: isEn
      ? 'Guides, updates, tips, and FAQs for AI card news automation, Instagram publishing, and social content operations.'
      : '카드뉴스 자동화, SNS 자동 업로드, 인스타그램 자동 게시를 위한 Shuffla 활용 가이드와 FAQ를 확인하세요.',
    alternates: {
      canonical: `${base}/${locale}/blog`,
      languages: { ko: `${base}/ko/blog`, en: `${base}/en/blog` },
    },
    openGraph: {
      title: isEn ? 'Blog | Shuffla Card News Studio' : '블로그 | Shuffla 카드뉴스 스튜디오',
      description: isEn
        ? 'Practical guides for AI card news automation and social publishing.'
        : 'AI 카드뉴스 자동화와 SNS 게시 운영을 위한 실전 가이드.',
      url: `${base}/${locale}/blog`,
      type: 'website',
      siteName: 'Shuffla',
      images: [{ url: `${base}/og-image.png`, width: 1200, height: 630, alt: 'Shuffla Blog' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: isEn ? 'Blog | Shuffla Card News Studio' : '블로그 | Shuffla 카드뉴스 스튜디오',
      description: isEn
        ? 'Guides for card news automation, social uploads, and Instagram publishing.'
        : '카드뉴스 자동화, SNS 자동 업로드, 인스타그램 자동 게시 가이드.',
      images: [`${base}/og-image.png`],
      site: '@shuffla_io',
    },
    keywords: isEn
      ? ['card news automation', 'AI content tips', 'Instagram publishing guide', 'social media content automation']
      : ['카드뉴스 자동화', 'SNS 자동 업로드', '인스타그램 자동 게시', 'AI 카드뉴스 제작', '카드뉴스 가이드'],
  }
}

const categoriesKo = [
  { name: '전체', color: 'bg-[#0a0a0a] text-white' },
  { name: '이용 가이드', color: 'bg-white border border-black/10 text-[#525252]' },
  { name: '릴리즈 노트', color: 'bg-white border border-black/10 text-[#525252]' },
  { name: 'FAQ', color: 'bg-white border border-black/10 text-[#525252]' },
]

const categoriesEn = [
  { name: 'All', color: 'bg-[#0a0a0a] text-white' },
  { name: 'Guides', color: 'bg-white border border-black/10 text-[#525252]' },
  { name: 'Release Notes', color: 'bg-white border border-black/10 text-[#525252]' },
  { name: 'FAQ', color: 'bg-white border border-black/10 text-[#525252]' },
]

const guidesKo = [
  { title: '브랜드 설정 마스터하기', duration: '2:47', accent: 'from-[#ff6b35] to-[#f7931e]' },
  { title: '카드뉴스 9분 만에 만들기', duration: '9:22', accent: 'from-[#1c7ed6] to-[#339af0]' },
]

const guidesEn = [
  { title: 'Mastering brand setup', duration: '2:47', accent: 'from-[#ff6b35] to-[#f7931e]' },
  { title: 'Build card news in 9 minutes', duration: '9:22', accent: 'from-[#1c7ed6] to-[#339af0]' },
]

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const authenticated = Boolean(await getSessionUser())
  const isEn = locale === 'en'
  const posts = getBlogPosts(locale)
  const featured = posts[3]
  const categories = isEn ? categoriesEn : categoriesKo
  const guides = isEn ? guidesEn : guidesKo

  return (
    <div className="min-h-screen bg-[#fafaf7] text-[#0a0a0a] flex flex-col selection:bg-[#ff6b35]/20">
      <MarketingNav authenticated={authenticated} locale={locale} />

      <main className="flex-1">
        <section className="relative overflow-hidden pt-20 pb-12 lg:pt-28 lg:pb-16">
          <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#ff6b35]">Blog</p>
            <h1 className="mt-5 max-w-3xl text-[44px] font-black leading-[1.05] tracking-[-0.045em] text-[#0a0a0a] md:text-[60px]">
              {isEn ? 'Guides, updates,\nand everything Shuffla' : '카드뉴스 자동화 가이드부터\n최신 업데이트까지'}
            </h1>
            <p className="mt-7 max-w-xl text-[17px] leading-8 text-[#525252]">
              {isEn
                ? 'Practical articles for AI card news automation, social uploads, and Instagram publishing.'
                : '카드뉴스 자동화, SNS 자동 업로드, 인스타그램 자동 게시를 더 효율적으로 운영하는 방법을 정리했습니다.'}
            </p>
          </div>
        </section>

        <section className="pb-16">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-3">
              <Link
                href={`/${locale}/blog/${featured.slug}`}
                className="group relative flex min-h-[400px] flex-col justify-end overflow-hidden rounded-[22px] bg-gradient-to-br from-[#fff4e6] via-[#ffe8cc] to-[#ffd6a5] p-10 md:p-12 lg:col-span-2"
              >
                <div className="relative">
                  <div className="mb-6 flex items-center gap-3">
                    <span className={`inline-block rounded-full px-3 py-1.5 text-[12px] font-black ${featured.tagClass}`}>{featured.category}</span>
                    <span className="text-[13px] font-bold text-[#0a0a0a]/60">{featured.date}</span>
                    <span className="text-[13px] text-[#0a0a0a]/60">·</span>
                    <span className="text-[13px] font-bold text-[#0a0a0a]/60">{featured.readTime}</span>
                  </div>
                  <h2 className="text-[32px] font-black leading-[1.1] tracking-[-0.04em] text-[#0a0a0a] md:text-[40px]">{featured.title}</h2>
                  <p className="mt-5 max-w-xl text-[16px] leading-[1.65] text-[#0a0a0a]/75">{featured.desc}</p>
                  <div className="mt-8 inline-flex items-center gap-2 text-[14px] font-black text-[#0a0a0a] transition-all group-hover:gap-3">
                    {isEn ? 'Read more' : '자세히 읽기'} <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>

              <div className="flex flex-col justify-between rounded-[22px] bg-[#0a0a0a] p-10 text-white">
                <div>
                  <Sparkles className="h-7 w-7 text-[#ff6b35]" strokeWidth={2.2} />
                  <h3 className="mt-6 text-[24px] font-black leading-[1.2] tracking-[-0.025em]">
                    {isEn ? 'Watch quick guides' : '영상으로 빠르게 보기'}
                  </h3>
                  <p className="mt-4 text-[14px] leading-[1.6] text-white/60">
                    {isEn ? 'Learn Shuffla core features with short video guides.' : '짧은 영상으로 Shuffla 핵심 기능을 빠르게 익혀보세요.'}
                  </p>
                </div>
                <div className="mt-8 space-y-3">
                  {guides.map((guide) => (
                    <Link key={guide.title} href={`/${locale}/blog/${posts[0].slug}`} className="group flex items-center gap-3">
                      <div className={`flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-[11px] font-black text-white ${guide.accent}`}>
                        {guide.duration}
                      </div>
                      <span className="text-[13px] font-bold text-white/85 group-hover:text-white">{guide.title}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-8">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-2">
              {categories.map((category) => (
                <button key={category.name} className={`rounded-full px-4 py-2 text-[13px] font-bold transition-all hover:-translate-y-[1px] ${category.color}`}>
                  {category.name}
                </button>
              ))}
              <span className="ml-auto text-[13px] font-medium text-[#8a8a8a]">
                {posts.length} {isEn ? 'posts' : '개'}
              </span>
            </div>
          </div>
        </section>

        <section className="pb-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/${locale}/blog/${post.slug}`}
                  className="group relative flex flex-col rounded-[22px] border border-black/[0.06] bg-white p-7 transition-all hover:border-black/[0.12] hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.08)]"
                >
                  <div className="mb-5 flex items-center gap-2">
                    <span className={`inline-block rounded-md px-2.5 py-1 text-[11px] font-black ${post.tagClass}`}>{post.category}</span>
                    <span className="text-[12px] font-medium text-[#8a8a8a]">{post.date}</span>
                  </div>
                  <h3 className="mb-3 text-[18px] font-black leading-[1.3] tracking-[-0.02em] text-[#0a0a0a] transition-colors group-hover:text-[#ff6b35]">{post.title}</h3>
                  <p className="mb-6 flex-1 text-[14px] leading-[1.6] text-[#525252] line-clamp-3">{post.desc}</p>
                  <div className="flex items-center justify-between border-t border-black/[0.06] pt-4">
                    <span className="text-[12px] font-bold text-[#8a8a8a]">{post.readTime}</span>
                    <ArrowUpRight className="h-4 w-4 text-[#525252] transition-all group-hover:-translate-y-[1px] group-hover:translate-x-[1px] group-hover:text-[#ff6b35]" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter authenticated={authenticated} locale={locale} />
    </div>
  )
}

