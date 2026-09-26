import 'server-only';
import { cookies } from 'next/headers';
import { createRequestClient } from './server';

export async function serverClient(writable = false) {
  const jar = await cookies();
  return createRequestClient(process.env, {
    getAll: () => jar.getAll(),
    setAll: (values) => {
      // Proxy refreshes read-only Server Components and sets no-store cache headers.
      if (!writable) return;
      for (const { name, value, options } of values) jar.set(name, value, {
        ...options, httpOnly: true, sameSite: 'lax', path: '/',
        secure: !!process.env.PORTAL_ORIGIN?.startsWith('https://'),
      });
    },
  });
}
