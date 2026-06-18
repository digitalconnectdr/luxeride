'use client'
// ── Botón de avance de viaje para el conductor + no-show ───────────────────────

import { useState, useTransition } from 'react'
import { driverAdvanceTripAction, driverNoShowAction } from '@/app/actions/driver'

const NEXT_LABEL: Record<string, string> = {
  assigned:    '🚗 Iniciar ruta al pickup',
  en_route:    '📍 Marcar que llegué',
  arrived:     '▶️ Iniciar viaje',
  in_progress: '✓ Completar viaje',
}

export function DriverTripActions({
  bookingId,
  status,
}: {
  bookingId: string
  status: string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [confirmNoShow, setConfirmNoShow] = useState(false)

  const label = NEXT_LABEL[status]
  if (!label) return null

  function handleAdvance() {
    setError('')
    startTransition(async () => {
      const result = await driverAdvanceTripAction(bookingId)
      if (!result.success) setError(result.error ?? 'Error al actualizar')
    })
  }

  function handleNoShow() {
    setError('')
    startTransition(async () => {
      const result = await driverNoShowAction(bookingId)
      if (!result.success) {
        setError(result.error ?? 'Error al marcar no-show')
        setConfirmNoShow(false)
      }
    })
  }

  return (
    <div className="space-y-2.5">
      <button
        onClick={handleAdvance}
        disabled={isPending}
        className="w-full py-3.5 text-sm font-semibold bg-gold text-gray-900 rounded-xl hover:bg-gold/90 disabled:opacity-50 transition-colors shadow-lg shadow-black/30"
      >
        {isPending ? 'Guardando…' : label}
      </button>

      {/* No-show: solo cuando el conductor ya llegó al punto */}
      {status === 'arrived' && (
        confirmNoShow ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 space-y-2">
            <p className="text-xs text-red-300">
              ¿Marcar que el pasajero <strong>no se presentó</strong>? Esto cancela el viaje.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmNoShow(false)}
                disabled={isPending}
                className="flex-1 py-2 text-xs font-medium border border-white/15 rounded-lg text-white/80 hover:bg-white/5 transition-colors"
              >
                Volver
              </button>
              <button
                onClick={handleNoShow}
                disabled={isPending}
                className="flex-1 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Guardando…' : 'Confirmar no-show'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmNoShow(true)}
            disabled={isPending}
            className="w-full py-2.5 text-xs font-medium text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10 disabled:opacity-50 transition-colors"
          >
            ⚠️ El pasajero no se presentó (no-show)
          </button>
        )
      )}

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
