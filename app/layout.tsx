import type { Metadata } from "next";
import "./globals.css";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Shuffla — AI 카드뉴스 스튜디오 | Card News Studio',
    template: '%s — Shuffla',
  },
  description: '브랜드 URL만 입력하면 AI가 카드뉴스의 기획, 카피, 비주얼을 만들고 편집·다운로드까지 — AI Card News Studio for brands, marketers, and creators worldwide.',
  keywords: [
    // Korean
    '카드뉴스', '카드뉴스 제작', 'AI 카드뉴스', '카드뉴스 자동 생성', 'SNS 카드뉴스',
    '인스타그램 카드뉴스', '카드뉴스 템플릿', '카드뉴스 만들기', '마케팅 카드뉴스',
    '브랜드 카드뉴스', '소셜 미디어 콘텐츠', 'AI 콘텐츠 제작', '카드뉴스 스튜디오',
    '카드뉴스 디자인', 'SNS 마케팅', '인스타그램 마케팅', '카드뉴스 편집',
    'AI 이미지 생성', '브랜드 분석', 'SNS 콘텐츠 자동 생성', 'Shuffla', '셔플라',
    // English
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
    title: 'Shuffla — AI 카드뉴스 스튜디오 | Card News Studio',
    description: '브랜드 URL만 입력하면 AI가 카드뉴스의 기획, 카피, 비주얼을 만들고 편집·다운로드까지. From brand URL to publishable card news in minutes.',
    url: BASE_URL,
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Shuffla — AI Card News Studio', type: 'image/png' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@shuffla_io',
    creator: '@shuffla_io',
    title: 'Shuffla — AI Card News Studio',
    description: 'From brand URL to publishable card news — AI plans, writes, and visualizes your social content.',
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
  alternates: {
    canonical: BASE_URL,
    languages: {
      ko: `${BASE_URL}/ko`,
      en: `${BASE_URL}/en`,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
