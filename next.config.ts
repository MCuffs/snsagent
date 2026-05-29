import type { NextConfig } from "next";
import path from "path";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  serverExternalPackages: ['@resvg/resvg-js'],
  turbopack: {
    root: path.resolve(__dirname),
  },
  outputFileTracingIncludes: {
    '**': ['./public/fonts/**'],
  },
};

export default withNextIntl(nextConfig);
