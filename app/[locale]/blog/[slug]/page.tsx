import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarDays, Clock } from 'lucide-react'
import { MarketingNav } from '../../../components/MarketingNav'
import { MarketingFooter } from '../../../components/MarketingFooter'
import { getSessionUser } from '../../../../lib/auth/user'
import { getAllBlogPostPaths, getBlogPost } from '../../../../lib/blog-posts'

type BlogPostPageProps = {
  params: Promise<{ locale: string; slug: string }>
}

export function generateStaticParams() {
  return getAllBlogPostPaths()
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { locale, slug } = await params
  const post = getBlogPost(locale, decodeURIComponent(slug))
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'

  if (!post) {
    return {
      title: locale === 'en' ? 'Post not found | Shuffla' : '글을 찾을 수 없습니다 | Shuffla',
    }
  }

  return {
    title: `${post.title} | Shuffla`,
    description: post.desc,
    alternates: {
      canonical: encodeURI(`${base}/${locale}/blog/${post.slug}`),
      languages: (() => {
        const pairedSlug = SLUG_PAIR[post.slug]
        const koSlug = locale === 'ko' ? post.slug : pairedSlug
        const enSlug = locale === 'en' ? post.slug : pairedSlug
        const langs: Record<string, string> = {}
        if (koSlug) langs['ko'] = encodeURI(`${base}/ko/blog/${koSlug}`)
        if (enSlug) langs['en'] = encodeURI(`${base}/en/blog/${enSlug}`)
        langs['x-default'] = encodeURI(`${base}/ko/blog/${koSlug || post.slug}`)
        return langs
      })(),
    },
    openGraph: {
      title: post.title,
      description: post.desc,
      url: `${base}/${locale}/blog/${post.slug}`,
      type: 'article',
      siteName: 'Shuffla',
      publishedTime: '2026-05-20',
      images: [{ url: `${base}/og-image.png`, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.desc,
      images: [`${base}/og-image.png`],
      site: '@shuffla_io',
    },
    keywords: post.keywords,
  }
}

// ko ↔ en slug 대응 맵
const SLUG_PAIR: Record<string, string> = {
  '카드뉴스-자동화-가이드': 'card-news-automation-guide',
  '카드뉴스-주제-선정법': 'best-topics-for-card-news',
  '제품-이미지-카드뉴스-품질': 'product-images-card-news-quality',
  '셔플라-공식-런칭': 'shuffla-official-launch',
  '요금제-결제-faq': 'billing-subscription-faq',
  'ai-저작권-faq': 'ai-copyright-faq',
  'card-news-automation-guide': '카드뉴스-자동화-가이드',
  'best-topics-for-card-news': '카드뉴스-주제-선정법',
  'product-images-card-news-quality': '제품-이미지-카드뉴스-품질',
  'shuffla-official-launch': '셔플라-공식-런칭',
  'billing-subscription-faq': '요금제-결제-faq',
  'ai-copyright-faq': 'ai-저작권-faq',
}

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

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { locale, slug } = await params
  const post = getBlogPost(locale, decodeURIComponent(slug))
  const authenticated = Boolean(await getSessionUser())
  const isEn = locale === 'en'

  if (!post) {
    notFound()
  }

  const postImage = postImages[post.slug] || '/front/card-01.webp'
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.desc,
    datePublished: '2026-05-20',
    dateModified: '2026-05-20',
    url: `${base}/${locale}/blog/${post.slug}`,
    author: { '@type': 'Organization', name: 'Shuffla' },
    publisher: {
      '@type': 'Organization',
      name: 'Shuffla',
      logo: { '@type': 'ImageObject', url: `${base}/logo.svg` },
    },
    keywords: post.keywords.join(', '),
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 relative overflow-hidden selection:bg-sky-500/20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Background glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-sky-100/10 to-transparent rounded-full blur-3xl opacity-60 z-0" />

      <MarketingNav authenticated={authenticated} locale={locale} />

      <main className="relative z-10">
        <article className="mx-auto max-w-3xl px-6 pb-28 pt-20 lg:pt-28">
          <Link
            href={`/${locale}/blog`}
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-[#0066ff]"
          >
            <ArrowLeft className="h-4 w-4" />
            {isEn ? 'Back to blog' : '블로그로 돌아가기'}
          </Link>

          <header className="mt-12 border-b border-slate-100 pb-10">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`inline-block rounded-full px-3 py-1.5 text-[11px] font-bold ${post.tagClass}`}>{post.category}</span>
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-400">
                <CalendarDays className="h-4 w-4" />
                {post.date}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-400">
                <Clock className="h-4 w-4" />
                {post.readTime}
              </span>
            </div>
            <h1 className="mt-6 text-[36px] font-extrabold leading-[1.15] tracking-[-0.03em] text-slate-900 md:text-[48px]">
              {post.title}
            </h1>
            <p className="mt-6 text-[17px] leading-relaxed text-slate-500 font-medium">{post.desc}</p>
          </header>

          {/* Post Banner Image */}
          <div className="mt-10 aspect-[16/9] w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50 relative">
            <img
              src={postImage}
              alt={post.title}
              className="object-cover w-full h-full"
            />
          </div>

          <div className="mt-12 space-y-12">
            {post.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-[24px] font-bold leading-[1.3] tracking-[-0.02em] text-slate-900">{section.heading}</h2>
                <div className="mt-5 space-y-5">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-[16px] leading-[1.75] text-slate-600 font-medium">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <footer className="mt-14 border-t border-slate-100 pt-8">
            <div className="flex flex-wrap gap-2">
              {post.keywords.map((keyword) => (
                <span key={keyword} className="rounded-full bg-slate-50 border border-slate-200/60 px-3 py-1.5 text-[12px] font-bold text-slate-500">
                  {keyword}
                </span>
              ))}
            </div>
          </footer>
        </article>
      </main>

      <MarketingFooter authenticated={authenticated} locale={locale} />
    </div>
  )
}

