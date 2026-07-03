'use client'
// ── El conductor controla su propia disponibilidad ("en servicio") ────────────
// Antes esto era solo una etiqueta fija en el header — ahora es el interruptor
// real que decide si el conductor entra en el reparto de auto-asignación.

import { useTransition } from 'react'
import { driverSetAvailabilityAction } from '@/app/actions/driver'

export interface DriverAvailabilityLabels {
  onDuty: string
  offDuty: string
  saving: string
}

export function DriverSelfAvailabilityToggle({
  isAvailable,
  labels,
}: {
  isAvailable: boolean
  labels: DriverAvailabilityLabels
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(async () => { await driverSetAvailabilityAction(!isAvailable) })}
      className={[
        'inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full border px-2.5 py-1 transition-colors disabled:opacity-60',
        isAvailable
          ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
          : 'border-[#e5e1d8] bg-[#faf8f3] text-[#75716a] hover:bg-[#f0ede5]',
      ].join(' ')}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isAvailable ? 'bg-green-500' : 'bg-[#a8a39a]'}`} />
      {isPending ? labels.saving : isAvailable ? labels.onDuty : labels.offDuty}
    </button>
  )
}
