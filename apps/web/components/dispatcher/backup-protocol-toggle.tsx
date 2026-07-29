'use client'
// ── Protocolo de respaldo (Guaranteed Ride) — Activado / Desactivado ──────────
// Cuando está activo, un job de fondo (pg_cron cada ~5 min, ver lib/dispatch/
// risk.ts) vigila las reservas ya asignadas cerca del pickup y reasigna DENTRO
// de la misma flota si detecta que el conductor no va a llegar a tiempo — sin
// esperar a que el pasajero se dé cuenta.

import { useState, useTransition } from 'react'
import { updateBackupProtocolSettingAction } from '@/app/actions/dispatch-settings'
import { InfoTip } from '@/components/ui/info-tip'
import type { Dictionary } from '@/lib/i18n/server'

export function BackupProtocolToggle({
  initialEnabled,
  labels,
}: {
  initialEnabled: boolean
  labels: Dictionary['dispatch']['backupProtocol']
}) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [isPending, startTransition] = useTransition()

  function toggle() {
    const next = !enabled
    setEnabled(next)
    startTransition(async () => {
      const res = await updateBackupProtocolSettingAction(next)
      if (!res.success) setEnabled(!next)
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
            ? 'border-[#c9a24b]/40 bg-[#c9a24b]/10 text-[#8a6a1e] hover:bg-[#c9a24b]/20'
            : 'border-sl-outline-variant bg-sl-bg text-sl-on-surface-muted hover:bg-sl-outline-variant/20'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${enabled ? 'bg-[#c9a24b]' : 'bg-sl-on-surface-muted'}`} />
        {labels.label}: {isPending ? '…' : enabled ? labels.on : labels.off}
      </button>
      <InfoTip text={labels.infoTip} />
    </div>
  )
}
