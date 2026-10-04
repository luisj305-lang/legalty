import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parsePublicConfiguration } from '../../../lib/configuration.ts';

export const runtime = 'nodejs';

// Minimal RPC surface the route depends on. Tests inject a stub reader so the
// handler is exercised without a network call or a real Supabase project.
export interface SlotsReader {
  rpc(name: 'list_available_call_slots'): PromiseLike<{ data: unknown; error: unknown }>;
}

export interface PublicSlot {
  starts_at: string;
}

// Generic, non-enumerating failure. Never includes internal errors or keys.
const unavailable = () => Response.json({ error: 'slots_unavailable' }, { status: 503 });

// Keeps only the booked instant. Any unexpected payload shape fails closed.
function toSlots(payload: unknown): PublicSlot[] | null {
  if (!Array.isArray(payload)) return null;
  const slots: PublicSlot[] = [];
  for (const row of payload) {
    if (typeof row !== 'object' || row === null) return null;
    const { starts_at: startsAt } = row as Record<string, unknown>;
    if (typeof startsAt !== 'string') return null;
    slots.push({ starts_at: startsAt });
  }
  return slots;
}

// Calls the anon-granted RPC. Any provider error or unexpected payload fails
// closed; no internal error text ever reaches the response body.
export async function readCallSlots(reader: SlotsReader): Promise<Response> {
  try {
    const { data, error } = await reader.rpc('list_available_call_slots');
    if (error) return unavailable();
    const slots = toSlots(data);
    if (!slots) return unavailable();
    return Response.json({ slots });
  } catch {
    return unavailable();
  }
}

// Builds the server-side public client from validated env. It uses only the
// publishable (anon) key with RLS, never a service-role credential.
export function publicCallSlotsClient(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): SupabaseClient | null {
  const configuration = parsePublicConfiguration(environment);
  if (!configuration) return null;
  return createClient(configuration.url, configuration.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
}

export async function GET(): Promise<Response> {
  const client = publicCallSlotsClient();
  if (!client) return unavailable();
  return readCallSlots(client);
}
