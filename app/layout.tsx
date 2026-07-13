import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Shuffla — AI 영상 카드뉴스 생성 플랫폼 | Video Card News Generator',
    template: '%s — Shuffla',
  },
  description: '브랜드 URL과 주제만 입력하면 AI가 영상 카드뉴스와 이미지 카드뉴스의 기획, 카피, 비주얼, 영상 프롬프트까지 생성합니다 — AI Video Card News Generator for brands and marketers.',
  keywords: [
    // Korean
    '영상 카드뉴스', '영상 카드뉴스 생성', 'AI 영상 카드뉴스', '영상 카드뉴스 만들기',
    '영상 생성', 'AI 숏폼 카드뉴스', '숏폼 카드뉴스', '영상 콘텐츠 자동 생성',
    '카드뉴스', '카드뉴스 제작', 'AI 카드뉴스', '카드뉴스 자동 생성', 'SNS 카드뉴스',
    '인스타그램 카드뉴스', '카드뉴스 템플릿', '카드뉴스 만들기', '마케팅 카드뉴스',
    '브랜드 카드뉴스', '소셜 미디어 콘텐츠', 'AI 콘텐츠 제작', '카드뉴스 스튜디오',
    '카드뉴스 디자인', 'SNS 마케팅', '인스타그램 마케팅', '카드뉴스 편집',
    'AI 이미지 생성', '브랜드 분석', 'SNS 콘텐츠 자동 생성', 'Shuffla', '셔플라',
    // English
    'video card news', 'AI video card news', 'video card news generator',
    'AI video generator', 'AI short form content', 'social video generator',
    'card news', 'AI card news', 'social card news', 'Instagram card news',
    'card news maker', 'card news generator', 'AI content creation',
    'social media content', 'brand content creation', 'AI marketing tool',
    'carousel post maker', 'Instagram carousel', 'visual content tool',
  ],
  authors: [{ name: 'Shuffla', url: BASE_URL }],
  creator: 'Shuffla',
  publisher: 'Shuffla',
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    type: 'website',
    siteName: 'Shuffla',
    locale: 'ko_KR',
    alternateLocale: ['en_US'],
    title: 'Shuffla — AI 영상 카드뉴스 생성 플랫폼',
    description: '브랜드 URL과 주제만 입력하면 AI가 영상 카드뉴스 기획, 카피, 영상 프롬프트, 이미지 카드뉴스까지 한 번에 만듭니다.',
    url: BASE_URL,
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Shuffla — AI Card News Studio', type: 'image/png' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@shuffla_io',
    creator: '@shuffla_io',
    title: 'Shuffla — AI Video Card News Generator',
    description: 'Create video card news and image card news from a brand URL and topic. AI plans, writes, visualizes, and prepares video prompts.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/shuffla-logo-mark.png',
    apple: '/shuffla-logo-mark.png',
    shortcut: '/shuffla-logo-mark.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {},
  category: 'technology',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=AW-18221005488"
        strategy="afterInteractive"
      />
      <Script id="google-ads-gtag" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'AW-18221005488');
        `}
      </Script>
    </>
  );
}
