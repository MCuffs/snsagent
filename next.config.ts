import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import { withWorkflow } from 'workflow/next';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  serverExternalPackages: ['@resvg/resvg-js', '@ffmpeg-installer/ffmpeg', '@ffmpeg-installer/linux-x64'],
  async rewrites() {
    return [
      { source: '/sitemap.xml', destination: '/api/sitemap' },
      { source: '/robots.txt', destination: '/api/robots' },
    ]
  },
  async headers() {
    // Content Security Policy
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net https://www.googletagmanager.com https://googleads.g.doubleclick.net https://www.googleadservices.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https: http:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.openai.com https://api.perplexity.ai https://generativelanguage.googleapis.com https://api.groq.com https://openapi.naver.com https://graph.instagram.com https://api.polar.sh https://*.vercel.app https://*.blob.vercel-storage.com https://r.jina.ai https://commons.wikimedia.org https://api.thinkingdata.com https://te-receiver-naver.thinkingdata.kr https://www.google-analytics.com https://*.google-analytics.com https://googleads.g.doubleclick.net https://www.googleadservices.com https://ad.doubleclick.net https://www.google.com",
      "media-src 'self' blob: https://*.blob.vercel-storage.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ]

    const cspHeader = cspDirectives.join('; ')

    // Shorts Lab 데모는 YouTube IFrame 플레이어로 하이라이트 구간을 재생만 합니다.
    // 전역 CSP 를 넓히지 않고 이 경로에서만 frame-src 를 허용합니다.
    const shortsLabCsp = [
      ...cspDirectives,
      'frame-src https://www.youtube-nocookie.com https://www.youtube.com',
    ].join('; ')

    const shortsLabPaths = [
      '/shorts-lab',
      '/shorts-lab/:path*',
      '/:locale/shorts-lab',
      '/:locale/shorts-lab/:path*',
    ]

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(self)',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
        ],
      },
      // 같은 키의 헤더는 뒤쪽 항목이 앞쪽을 덮어씁니다.
      ...shortsLabPaths.map(source => ({
        source,
        headers: [{ key: 'Content-Security-Policy', value: shortsLabCsp }],
      })),
    ];
  },
  turbopack: {
    root: __dirname,
  },
};

export default withWorkflow(withNextIntl(nextConfig));
