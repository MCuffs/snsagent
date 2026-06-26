import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}
import localFont from "next/font/local";
import "../globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '../../i18n/routing';
import ThinkingDataProvider from '../components/ThinkingDataProvider';

const pretendard = localFont({
  variable: "--font-pretendard",
  display: "swap",
  src: [
    {
      path: "../../public/fonts/Pretendard-Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/Pretendard-SemiBold.otf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/Pretendard-Bold.otf",
      weight: "700",
      style: "normal",
    },
  ],
});

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Shuffla — AI 카드뉴스 스튜디오 | Card News Studio',
    template: '%s — Shuffla',
  },
  description: '브랜드 URL만 입력하면 AI가 카드뉴스의 기획, 카피, 비주얼을 만들고 편집·다운로드까지 — AI-powered social card news creation for brands and marketers.',
  keywords: [
    '카드뉴스', '카드뉴스 제작', 'AI 카드뉴스', '인스타그램 카드뉴스',
    'SNS 마케팅', 'AI 콘텐츠 제작', '브랜드 분석', '카드뉴스 템플릿',
    'card news', 'AI card news', 'Instagram carousel', 'social media content',
    'brand content', 'AI marketing tool', 'visual content creation',
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
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Shuffla — AI Card News Studio' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@shuffla_io',
    creator: '@shuffla_io',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/shuffla-logo-mark.png',
    apple: '/shuffla-logo-mark.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  alternates: {
    languages: { ko: `${BASE_URL}/ko`, en: `${BASE_URL}/en` },
  },
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as 'ko' | 'en')) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} className={`${pretendard.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={messages}>
          <ThinkingDataProvider locale={locale} />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
