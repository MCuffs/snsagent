import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@resvg/resvg-js'],
  turbopack: {
    root: path.resolve(__dirname),
  },
  outputFileTracingIncludes: {
    '**': ['./public/fonts/**'],
  },
};

export default nextConfig;
