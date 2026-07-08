import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
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
      ? 'Guides, updates, tips, and FAQs for AI card news creation with Shuffla.'
      : 'AI 카드뉴스 제작과 Shuffla 활용 가이드, FAQ를 확인하세요.',
    alternates: {
      canonical: `${base}/${locale}/blog`,
      languages: { ko: `${base}/ko/blog`, en: `${base}/en/blog`, 'x-default': `${base}/ko/blog` },
    },
    openGraph: {
      title: isEn ? 'Blog | Shuffla Card News Studio' : '블로그 | Shuffla 카드뉴스 스튜디오',
      description: isEn
        ? 'Practical guides for AI card news creation and content strategy.'
        : 'AI 카드뉴스 제작과 콘텐츠 전략을 위한 실전 가이드.',
      url: `${base}/${locale}/blog`,
      type: 'website',
      siteName: 'Shuffla',
      images: [{ url: `${base}/og-image.png`, width: 1200, height: 630, alt: 'Shuffla Blog' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: isEn ? 'Blog | Shuffla Card News Studio' : '블로그 | Shuffla 카드뉴스 스튜디오',
      description: isEn
        ? 'Guides for AI card news creation and content workflow.'
        : 'AI 카드뉴스 제작 가이드.',
      images: [`${base}/og-image.png`],
      site: '@shuffla_io',
    },
    keywords: isEn
      ? ['card news creator', 'AI content tips', 'card news guide', 'social media content']
      : ['카드뉴스 제작', 'AI 카드뉴스', '카드뉴스 가이드', '콘텐츠 제작'],
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

const _guidesKo = [
  { title: '브랜드 설정 마스터하기', duration: '2:47', accent: 'from-[#ff6b35] to-[#f7931e]' },
  { title: '카드뉴스 9분 만에 만들기', duration: '9:22', accent: 'from-[#1c7ed6] to-[#339af0]' },
]

const _guidesEn = [
  { title: 'Mastering brand setup', duration: '2:47', accent: 'from-[#ff6b35] to-[#f7931e]' },
  { title: 'Build card news in 9 minutes', duration: '9:22', accent: 'from-[#1c7ed6] to-[#339af0]' },
]

const postImages: Record<string, string> = {
  // Korean slugs
  '카드뉴스-자동화-가이드': '/front/card-10.webp',
  '카드뉴스-주제-선정법': '/front/card-13.webp',
  '제품-이미지-카드뉴스-품질': '/front/card-11.webp',
  '셔플라-공식-런칭': '/front/card-04.webp',
  '요금제-결제-faq': '/front/card-01.webp',
  'ai-저작권-faq': '/front/card-15.webp',
  // English slugs
  'card-news-automation-guide': '/front/card-10.webp',
  'best-topics-for-card-news': '/front/card-13.webp',
  'product-images-card-news-quality': '/front/card-11.webp',
  'shuffla-official-launch': '/front/card-04.webp',
  'billing-subscription-faq': '/front/card-01.webp',
  'ai-copyright-faq': '/front/card-15.webp',
}

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const authenticated = Boolean(await getSessionUser())
  const isEn = locale === 'en'
  const posts = getBlogPosts(locale)
  const featured = posts[3] // Shuffla launch post
  const featuredImage = postImages[featured.slug] || '/front/card-04.webp'
  const categories = isEn ? categoriesEn : categoriesKo

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col relative overflow-hidden selection:bg-sky-500/20">
      {/* Background glow and grid pattern */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-to-b from-sky-100/20 via-sky-50/5 to-transparent rounded-full blur-3xl opacity-70 z-0" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-[0.15] z-0" />

      <MarketingNav authenticated={authenticated} locale={locale} />

      <main className="flex-1 relative z-10">
        {/* Header Section */}
        <section className="relative pt-20 pb-12 lg:pt-28 lg:pb-16">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-brand-blue">Blog</p>
            <h1 className="mt-5 max-w-3xl text-[40px] font-black leading-[1.1] tracking-[-0.04em] text-slate-900 md:text-[54px] whitespace-pre-line">
              {isEn ? 'Guides, updates,\nand everything Shuffla' : '카드뉴스 자동화 가이드부터\n최신 업데이트까지'}
            </h1>
            <p className="mt-6 max-w-xl text-[16px] leading-7 text-slate-500 font-medium">
              {isEn
                ? 'Practical articles on how to create better card news with AI — tips, workflows, and updates.'
                : 'AI 카드뉴스를 더 잘 만드는 방법을 정리했습니다. 활용 팁, 워크플로우, 업데이트를 확인하세요.'}
            </p>
          </div>
        </section>

        {/* Featured Post Split-Layout Section */}
        <section className="pb-16">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <Link
              href={`/${locale}/blog/${featured.slug}`}
              className="group block rounded-[28px] border border-slate-200/80 bg-white/60 backdrop-blur-md p-6 md:p-8 shadow-[0_12px_40px_-20px_rgba(14,165,233,0.08)] hover:border-sky-200 hover:shadow-[0_20px_50px_-15px_rgba(14,165,233,0.12)] transition-all duration-300"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
                {/* Left: Rounded Image Container */}
                <div className="aspect-[4/3] w-full relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
                  <Image
                    src={featuredImage}
                    alt={featured.title}
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover transform transition-transform duration-500 group-hover:scale-102"
                  />
                </div>

                {/* Right: Info and Text Details */}
                <div className="flex flex-col justify-center">
                  <div className="mb-4 flex items-center gap-3 text-xs">
                    <span className={`inline-block rounded-full px-3 py-1.5 text-[11px] font-bold ${featured.tagClass}`}>{featured.category}</span>
                    <span className="text-slate-400 font-semibold">{featured.date}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-400 font-semibold">{featured.readTime}</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold leading-[1.2] tracking-[-0.03em] text-slate-900 group-hover:text-brand-blue transition-colors duration-300">
                    {featured.title}
                  </h2>
                  <p className="mt-5 text-[15px] leading-relaxed text-slate-500 font-medium">
                    {featured.desc}
                  </p>
                  <div className="mt-8 inline-flex items-center gap-1.5 text-sm font-bold text-brand-blue group-hover:text-brand-blue-hover transition-colors">
                    {isEn ? 'Read full article' : '전체 읽기'} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* Categories Bar */}
        <section className="pb-10">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-6">
              {categories.map((category) => {
                const isAll = category.name === '전체' || category.name === 'All';
                return (
                  <button
                    key={category.name}
                    className={`rounded-full px-4.5 py-2 text-[13px] font-bold transition-all ${
                      isAll
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'bg-white border border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    {category.name}
                  </button>
                );
              })}
              <span className="ml-auto text-[13px] font-bold text-slate-400">
                {posts.length} {isEn ? 'posts' : '개'}
              </span>
            </div>
          </div>
        </section>

        {/* Recent Posts Grid */}
        <section className="pb-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => {
                const postImage = postImages[post.slug] || '/front/card-01.webp'
                return (
                  <Link
                    key={post.slug}
                    href={`/${locale}/blog/${post.slug}`}
                    className="group relative flex flex-col rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-[0_4px_20px_-10px_rgba(0,0,0,0.03)] transition-all duration-300 hover:border-sky-200 hover:shadow-[0_20px_40px_-15px_rgba(14,165,233,0.08)] hover:-translate-y-1"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden border-b border-slate-100 bg-slate-50 relative">
                      <Image
                        src={postImage}
                        alt={post.title}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                        className="object-cover transform transition-transform duration-500 group-hover:scale-102"
                      />
                    </div>
                    <div className="p-6 flex flex-col flex-1">
                      <div className="mb-4 flex items-center gap-3 text-xs">
                        <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${post.tagClass}`}>{post.category}</span>
                        <span className="text-slate-400 font-semibold">{post.date}</span>
                      </div>
                      <h3 className="mb-3 text-[18px] font-bold leading-[1.4] text-slate-900 group-hover:text-brand-blue transition-colors duration-300 line-clamp-2">
                        {post.title}
                      </h3>
                      <p className="mb-6 flex-1 text-[14px] leading-relaxed text-slate-500 font-medium line-clamp-3">
                        {post.desc}
                      </p>
                      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                        <span className="text-[12px] font-bold text-slate-400">{post.readTime}</span>
                        <div className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 group-hover:text-brand-blue transition-colors">
                          {isEn ? 'Read article' : '읽기'} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter authenticated={authenticated} locale={locale} />
    </div>
  )
}

