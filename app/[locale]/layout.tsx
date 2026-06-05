import type { Metadata } from "next";
import localFont from "next/font/local";
import "../globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '../../i18n/routing';

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

export const metadata: Metadata = {
  title: {
    default: 'Shuffla',
    template: '%s — Shuffla',
  },
  description: 'AI card news studio for analyzing brands, generating, editing, and downloading social card news.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'),
  openGraph: {
    type: 'website',
    siteName: 'Shuffla',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Shuffla — AI Card News Studio' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@shuffla_io',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/shuffla-logo-mark.png',
    apple: '/shuffla-logo-mark.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
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
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
