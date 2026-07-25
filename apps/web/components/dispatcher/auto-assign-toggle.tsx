'use client'
// ── Auto-asignación: Automático / Manual ────────────────────────────────────────
// En Automático, cada reserva nueva se intenta asignar sola (lib/dispatch/
// auto-assign.ts) al conductor con mayor puntaje compuesto: cercanía, reparto
// justo, calificación y confiabilidad (lib/dispatch/scoring.ts).
// En Manual, todo queda pendiente para que Dispatch asigne a mano.

import { useState, useTransition } from 'react'
import { updateAutoAssignSettingAction } from '@/app/actions/dispatch-settings'
import { InfoTip } from '@/components/ui/info-tip'
import type { Dictionary } from '@/lib/i18n/server'

export function AutoAssignToggle({
  initialEnabled,
  labels,
}: {
  initialEnabled: boolean
  labels: Dictionary['dispatch']['autoAssign']
}) {
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
        {labels.label}: {isPending ? '…' : enabled ? labels.automatic : labels.manual}
      </button>
      <InfoTip text={labels.infoTip} />
    </div>
  )
}
