'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  submitBlockedDate, submitCancelBooking, submitWeeklyHours,
  type BlockedDateSource, type CancelBookingSource, type WeeklyHoursSource,
} from '../../../../lib/calls/availability';
import { serverClient } from '../../../../lib/supabase/next-client';
import { accountAccess } from '../../../../lib/supabase/server';

// One request-scoped source shared by every action. The Supabase client is
// created lazily so an unauthenticated or mistrusted mutation never reaches the
// provider.
function requestSource(): WeeklyHoursSource & BlockedDateSource & CancelBookingSource {
  let client: Awaited<ReturnType<typeof serverClient>> | undefined;
  const requestClient = async () => client ??= await serverClient(true);
  const detail = (error: unknown) => {
    const e = error as { message?: string; details?: string; hint?: string; code?: string } | null;
    return [e?.message, e?.details, e?.hint, e?.code].filter(Boolean).join(' | ') || String(error);
  };
  return {
    access: async () => accountAccess(await requestClient()),
    readWeekly: async () => {
      const { data, error } = await (await requestClient()).from('call_weekly_hours')
        .select('weekday,start_time,end_time').order('weekday').order('start_time');
      if (error) throw new Error('weekly read: ' + detail(error));
      return data;
    },
    writeWeekly: async ranges => {
      const { error } = await (await requestClient()).rpc('set_call_weekly_hours', {
        p_weekdays: ranges.map(range => range.weekday),
        p_start_times: ranges.map(range => range.start),
        p_end_times: ranges.map(range => range.end),
      });
      if (error) throw new Error('weekly write: ' + detail(error));
    },
    addBlocked: async day => {
      const { error } = await (await requestClient()).rpc('add_call_blocked_date', { p_day: day });
      if (error) throw new Error('blocked add: ' + detail(error));
    },
    removeBlocked: async day => {
      const { error } = await (await requestClient()).rpc('remove_call_blocked_date', { p_day: day });
      if (error) throw new Error('blocked remove: ' + detail(error));
    },
    cancelBooking: async appointmentId => {
      const { error } = await (await requestClient())
        .rpc('cancel_call_booking', { p_appointment_id: appointmentId });
      if (error) throw new Error('cancel: ' + detail(error));
    },
  };
}

export async function saveWeeklyHours(form: FormData) {
  const destination = await submitWeeklyHours(form, (await headers()).get('origin'),
    process.env.PORTAL_ORIGIN, requestSource());
  redirect(destination);
}

export async function changeBlockedDate(form: FormData) {
  const destination = await submitBlockedDate(form, (await headers()).get('origin'),
    process.env.PORTAL_ORIGIN, requestSource());
  redirect(destination);
}

export async function cancelBooking(appointmentId: string, form: FormData) {
  const destination = await submitCancelBooking(appointmentId, form,
    (await headers()).get('origin'), process.env.PORTAL_ORIGIN, requestSource());
  redirect(destination);
}
