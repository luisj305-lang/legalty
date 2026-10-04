'use client';

import { useEffect, useState } from 'react';
import { establishInviteSession } from './actions';

// Reads the Supabase invitation tokens from the URL (implicit `#access_token`
// / `refresh_token`, or a PKCE `?code=`), asks the server action to establish
// the portal session, then routes to the mandatory password setup. It never
// stores or displays the tokens.
export function InviteAccept() {
  const [state, setState] = useState<'working' | 'invalid'>('working');
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const query = new URLSearchParams(window.location.search);
    const input = {
      accessToken: hash.get('access_token') ?? undefined,
      refreshToken: hash.get('refresh_token') ?? undefined,
      code: query.get('code') ?? undefined,
    };
    if (!input.accessToken && !input.code) { setState('invalid'); return; }
    let active = true;
    establishInviteSession(input)
      .then(result => {
        if (!active) return;
        if (result === 'ok') window.location.assign('/portal/setup/password');
        else setState('invalid');
      })
      .catch(() => { if (active) setState('invalid'); });
    return () => { active = false; };
  }, []);
  return <main className="portal-shell"><section className="access-card">
    <p className="eyebrow">LEGALTY · INVITACIÓN</p>
    <h1>Activar tu acceso</h1>
    {state === 'working'
      ? <p role="status">Estamos verificando tu invitación…</p>
      : <p role="alert">No pudimos activar tu invitación. El enlace puede haber expirado o ya haberse usado. Solicita una nueva invitación a tu asesor.</p>}
  </section></main>;
}
