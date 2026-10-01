import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Minimal bridge between the legacy Vercel serverless handlers
 * (api/legacy/<name>.cjs, CommonJS (req, res) signature) and the Next.js App
 * Router route handlers (Request/Response).
 *
 * The legacy handlers are loaded at runtime through a dynamic import of a file
 * URL rooted at the process directory (next start/dev and `npm test` both
 * execute from the portal/web project root). The `turbopackIgnore` directive
 * keeps the bundler from resolving the handler's own `require('mercadopago')`
 * / `require('crypto')` dependencies at build time. The handler body,
 * contract, and environment reads are reused verbatim; nothing here rewrites
 * handler logic.
 */

export type LegacyHandlerName = 'contact' | 'create-preference' | 'webhook';

export interface LegacyRequest {
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface LegacyResponse {
  statusCode: number;
  headers: Record<string, string>;
  setHeader(name: string, value: string | number): void;
  end(payload?: unknown): void;
}

export type LegacyHandler = (req: LegacyRequest, res: LegacyResponse) => Promise<void>;

export async function loadLegacyHandler(name: LegacyHandlerName): Promise<LegacyHandler> {
  const file = join(process.cwd(), 'api', 'legacy', `${name}.cjs`);
  const mod = await import(/* turbopackIgnore: true */ pathToFileURL(file).href);
  const namespace = mod as { default?: unknown };
  return (namespace.default ?? mod) as LegacyHandler;
}

export async function adaptLegacy(handler: LegacyHandler, request: Request): Promise<Response> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const rawBody = await request.text();
  let body: unknown;
  if (rawBody !== '') {
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = rawBody;
    }
  } else {
    body = undefined;
  }

  const req: LegacyRequest = { method: request.method, headers, body };

  const responseHeaders: Record<string, string> = {};
  let payload = '';

  const res: LegacyResponse = {
    statusCode: 200,
    headers: responseHeaders,
    setHeader(name, value) {
      responseHeaders[name.toLowerCase()] = String(value);
    },
    end(value) {
      payload = value == null
        ? ''
        : (Buffer.isBuffer(value) ? value.toString('utf8') : String(value));
    },
  };

  await handler(req, res);

  return new Response(payload, { status: res.statusCode, headers: responseHeaders });
}
