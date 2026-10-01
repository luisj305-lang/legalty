import type { MetadataRoute } from 'next';
import { canonicalHost, portalEntryHref } from './site-config.ts';

/**
 * Crawler directives served at `/robots.txt`.
 *
 * The public landing is allowed; the private portal subtree, the real API
 * handlers, and the payment-return confirmation pages are excluded. The bare
 * `/portal` entry is additionally protected at the HTTP level by an
 * `X-Robots-Tag: noindex, nofollow` header (see next.config.ts).
 */
export function buildRobots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [`${portalEntryHref}/`, '/api/', '/success', '/failure'],
      },
    ],
    sitemap: `${canonicalHost}/sitemap.xml`,
  };
}

/**
 * Public URL allowlist served at `/sitemap.xml`.
 *
 * Only the indexable public landing pages are listed. Private, portal, API,
 * and payment-return URLs are never included.
 */
export function buildSitemap(): MetadataRoute.Sitemap {
  const paths = ['/', '/about', '/services', '/contact'];
  return paths.map((path) => ({ url: `${canonicalHost}${path}` }));
}
