'use client'
// ── Auto-asignación: Automático / Manual ────────────────────────────────────────
// En Automático, cada reserva nueva se intenta asignar sola (lib/dispatch/
// auto-assign.ts) al conductor en servicio con menos viajes completados hoy.
// En Manual, todo queda pendiente para que Dispatch asigne a mano.

import { useState, useTransition } from 'react'
import { updateAutoAssignSettingAction } from '@/app/actions/dispatch-settings'
import { InfoTip } from '@/components/ui/info-tip'

export function AutoAssignToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [isPending, startTransition] = useTransition()

  function toggle() {
    const next = !enabled
    setEnabled(next)
    startTransition(async () => {
      const res = await updateAutoAssignSettingAction(next)
      if (!res.success) setEnabled(!next) // revertir si falla
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full border px-3 py-1.5 transition-colors disabled:opacity-60 ${
          enabled
            ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
            : 'border-sl-outline-variant bg-sl-bg text-sl-on-surface-muted hover:bg-sl-outline-variant/20'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${enabled ? 'bg-green-500' : 'bg-sl-on-surface-muted'}`} />
        Auto-asignación: {isPending ? '…' : enabled ? 'Automático' : 'Manual'}
      </button>
      <InfoTip text="Automático: cada reserva nueva se asigna sola al conductor en servicio con menos viajes COMPLETADOS hoy (reparto justo) y sin choque de horario — si nadie califica, queda pendiente igual. Manual: apaga esto y todas las reservas quedan en Pendientes para que tú elijas el conductor desde este tablero. Se puede cambiar en cualquier momento." />
    </div>
  )
}
