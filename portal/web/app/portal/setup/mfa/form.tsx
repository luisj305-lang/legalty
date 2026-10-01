'use client';

import { useActionState, useEffect, useState } from 'react';
import type { Factor, MfaState } from '../../../../lib/auth/mfa';
import { updateMfa } from './actions';

export function MfaForm({ factors }: { factors: Factor[] }) {
  const [result, action, pending] = useActionState(updateMfa, { state: 'idle' } as MfaState);
  const [enrollment, setEnrollment] = useState<Extract<MfaState, { state: 'enrolled' }> | null>(null);
  useEffect(() => { if (result.state === 'enrolled') setEnrollment(result); }, [result]);
  const options = enrollment ? [{ id: enrollment.factorId, status: 'unverified' }] : factors;
  return <>
    {result.state === 'error' && <p role="alert">No fue posible verificar. Revisa el código e intenta nuevamente o contacta al equipo.</p>}
    {enrollment && <figure>
      <img src={enrollment.qr} alt="Código QR para configurar tu aplicación autenticadora" width={240} height={240} />
      <figcaption>Escanea este QR en tu autenticador. No lo compartas ni guardes capturas.</figcaption>
    </figure>}
    {options.length === 0 ? <form action={action}>
      <input type="hidden" name="intent" value="enroll" />
      <button disabled={pending} type="submit">Configurar autenticador</button>
    </form> : <form action={action} className="auth-form">
      <input type="hidden" name="intent" value="verify" />
      <label htmlFor="factorId">Autenticador</label>
      <select id="factorId" name="factorId">{options.map((factor, index) =>
        <option key={factor.id} value={factor.id}>Autenticador {index + 1} · {factor.status === 'verified' ? 'registrado' : 'pendiente'}</option>)}</select>
      <label htmlFor="code">Código de seis dígitos</label>
      <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
      <button disabled={pending} type="submit">Verificar código</button>
    </form>}
    {!enrollment && factors.some(f => f.status === 'unverified') &&
      <p>Hay una configuración pendiente. Usa el autenticador que ya escaneaste; si perdiste el QR, contacta al equipo. No se elimina automáticamente.</p>}
  </>;
}
