import { NextResponse, type NextRequest } from 'next/server.js';
import { createRequestClient } from './server.ts';
import { trustedOrigin } from '../auth/mutations.ts';

export async function refreshSession(request: NextRequest, factory = createRequestClient) {
  if (request.method === 'POST' && !trustedOrigin(request.headers.get('origin'), process.env.PORTAL_ORIGIN)) {
    return new NextResponse('Solicitud no permitida.', { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  let response = NextResponse.next({ request });
  response.headers.set('Cache-Control', 'private, no-store');
  try {
    const client = factory(process.env, {
      getAll: () => request.cookies.getAll(),
      setAll: (values, headers) => {
        for (const { name, value } of values) request.cookies.set(name, value);
        const previous = response;
        response = NextResponse.next({ request });
        for (const cookie of previous.cookies.getAll()) response.cookies.set(cookie);
        for (const header of ['cache-control', 'expires', 'pragma']) {
          const value = previous.headers.get(header);
          if (value) response.headers.set(header, value);
        }
        for (const { name, value, options } of values) response.cookies.set(name, value, {
          ...options, httpOnly: true, sameSite: 'lax', path: '/',
          secure: !!process.env.PORTAL_ORIGIN?.startsWith('https://'),
        });
        for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
      },
    });
    await client.auth.getUser();
  } catch { /* Protected pages independently verify identity and fail closed. */ }
  return response;
}
