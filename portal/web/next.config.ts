import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicRouteRewrites = [
  { source: '/', destination: '/index.html' },
  { source: '/index', destination: '/index.html' },
  { source: '/about', destination: '/about.html' },
  { source: '/services', destination: '/services.html' },
  { source: '/contact', destination: '/contact.html' },
  { source: '/success', destination: '/success.html' },
  { source: '/failure', destination: '/failure.html' },
];

const config: NextConfig = {
  poweredByHeader: false,
  turbopack: { root },
  outputFileTracingRoot: root,
  async rewrites() {
    return {
      beforeFiles: publicRouteRewrites,
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return [
      {
        source: '/portal/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default config;
