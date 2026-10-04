import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parsePublicConfiguration } from '../../../lib/configuration.ts';

export const runtime = 'nodejs';

// Minimal RPC surface the route depends on. Tests inject a stub writer so the
// handler is exercised without a network call or a real Supabase project.
export interface BookingWriter {
  rpc(name: 'create_call_booking', args: {
    p_starts_at: string; p_service_id: string; p_client_name: string;
    p_client_email: string; p_client_phone: string;
  }): PromiseLike<{ data: unknown; error: unknown }>;
}

const bookableServices = new Set(['llamada-30min', 'llamada-45min']);
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const uuidPattern = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

// Generic, non-enumerating failures. Internal errors and keys never leak.
const invalid = () => Response.json({ error: 'invalid_booking' }, { status: 400 });
const taken = () => Response.json({ error: 'slot_taken' }, { status: 409 });
const unavailable = () => Response.json({ error: 'booking_unavailable' }, { status: 503 });

// Reads a required, single, bounded, trimmed string field.
function text(body: Record<string, unknown>, key: string, minimum: number, maximum: number) {
  const value = body[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const length = [...trimmed].length;
  return length < minimum || length > maximum ? null : trimmed;
}

function instant(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 64) return null;
  return Number.isNaN(new Date(trimmed).getTime()) ? null : trimmed;
}

function errorCode(error: unknown) {
  if (error !== null && typeof error === 'object') {
    const code = (error as Record<string, unknown>).code;
    if (typeof code === 'string') return code;
  }
  return '';
}

// Validates the booking payload and registers the appointment BEFORE payment.
// A taken instant surfaces as the unique-violation code 23505.
export async function createCallBooking(writer: BookingWriter, body: unknown): Promise<Response> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return invalid();
  const record = body as Record<string, unknown>;
  const startsAt = instant(record.startsAt);
  const serviceId = text(record, 'serviceId', 1, 64);
  const clientName = text(record, 'clientName', 1, 200);
  const clientEmail = text(record, 'clientEmail', 3, 254);
  const clientPhone = text(record, 'clientPhone', 1, 32);
  if (!startsAt || !serviceId || !bookableServices.has(serviceId)) return invalid();
  if (!clientName || !clientEmail || !emailPattern.test(clientEmail) || !clientPhone) return invalid();

  try {
    const { data, error } = await writer.rpc('create_call_booking', {
      p_starts_at: startsAt, p_service_id: serviceId, p_client_name: clientName,
      p_client_email: clientEmail, p_client_phone: clientPhone,
    });
    if (error) return errorCode(error) === '23505' ? taken() : unavailable();
    if (typeof data === 'string' && uuidPattern.test(data)) {
      return Response.json({ ok: true, appointmentId: data });
    }
    return unavailable();
  } catch { return unavailable(); }
}

// Builds the server-side public client from validated env. It uses only the
// publishable (anon) key with RLS, never a service-role credential.
export function publicCallBookingClient(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): SupabaseClient | null {
  const configuration = parsePublicConfiguration(environment);
  if (!configuration) return null;
  return createClient(configuration.url, configuration.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try { body = await request.json(); }
  catch { return invalid(); }
  const client = publicCallBookingClient();
  if (!client) return unavailable();
  return createCallBooking(client, body);
}
