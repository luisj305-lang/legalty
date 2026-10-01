/**
 * Central, switchable public-site configuration.
 *
 * These values are the single source of truth for the public landing's
 * discovery signals (canonical URLs, robots, sitemap) and for the public
 * entry into the private portal. Change them HERE only — never scatter the
 * canonical host or the portal entry target across files.
 *
 * `canonicalHost` is the intended production host. It is configuration only:
 * the domain is NOT live yet, so nothing that consumes it may be read as a
 * claim that the host currently serves traffic.
 *
 * `portalEntryHref` is the public link into the private portal. It is
 * `/portal` today; when the portal moves to its own subdomain it becomes a
 * full origin (e.g. `https://portal.legalty.lat`) without any structural
 * change to the landing or its discovery files.
 */
export const canonicalHost = 'https://legalty.lat';
export const portalEntryHref = '/portal';
