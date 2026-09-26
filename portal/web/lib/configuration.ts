type Environment = Readonly<Record<string, string | undefined>>;

// This validates syntax only: it never connects or enables authentication.
export function parsePublicConfiguration(environment: Environment) {
  const url = environment.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || /\s/.test(url) || !publishableKey ||
      !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) return null;

  try {
    const endpoint = new URL(url);
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password ||
        endpoint.pathname !== '/' || endpoint.search || endpoint.hash) return null;
    return { url: endpoint.origin, publishableKey };
  } catch {
    return null;
  }
}
