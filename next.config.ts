import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
    ],
  },
  serverExternalPackages: [
    '@resvg/resvg-js',
    '@ffmpeg-installer/ffmpeg',
    '@ffmpeg-installer/linux-x64',
  ],
  async rewrites() {
    return [
      { source: '/sitemap.xml', destination: '/api/sitemap' },
      { source: '/robots.txt', destination: '/api/robots' },
      // ThinkingData 사설 수신 서버(http) 프록시 — https 페이지의 mixed content 차단 우회.
      // SDK 는 serverUrl 의 경로를 버리고 origin + /sync_js 로 전송하므로 루트 경로를 프록시합니다.
      { source: '/sync_js', destination: 'http://49.51.180.241:8991/sync_js' },
      { source: '/data_debug', destination: 'http://49.51.180.241:8991/data_debug' },
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

    // Shorts Lab은 독립 경로와 CMS의 concept 탭 양쪽에서 YouTube IFrame을 사용합니다.
    // 쿼리스트링의 tab 값은 headers()에서 구분할 수 없으므로 concept 경로에도 허용합니다.
    // @vercel/blob 클라이언트 업로드는 https://vercel.com/api/blob 을 경유하므로
    // connect-src에 vercel.com이 없으면 브라우저 캡처 업로드가 CSP에 차단됩니다.
    const shortsLabCsp = [
      ...cspDirectives.map(directive =>
        directive.startsWith('connect-src')
          ? `${directive} https://vercel.com`
          : directive,
      ),
      'frame-src https://www.youtube-nocookie.com https://www.youtube.com',
    ].join('; ')

    const shortsLabPaths = [
      '/shorts-lab',
      '/shorts-lab/:path*',
      '/:locale/shorts-lab',
      '/:locale/shorts-lab/:path*',
      '/concept',
      '/concept/:path*',
      '/:locale/concept',
      '/:locale/concept/:path*',
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

export default withNextIntl(nextConfig);
