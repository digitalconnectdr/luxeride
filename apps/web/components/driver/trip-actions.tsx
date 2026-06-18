'use client'
// ── Botón de avance de viaje para el conductor + no-show ───────────────────────

import { useState, useTransition } from 'react'
import { driverAdvanceTripAction, driverNoShowAction } from '@/app/actions/driver'

export interface DriverActionLabels {
  assigned: string
  en_route: string
  arrived: string
  in_progress: string
  saving: string
  noShow: string
  noShowQ: string
  back: string
  noShowConfirm: string
}

export function DriverTripActions({
  bookingId,
  status,
  labels,
}: {
  bookingId: string
  status: string
  labels: DriverActionLabels
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [confirmNoShow, setConfirmNoShow] = useState(false)

  const label = labels[status as 'assigned' | 'en_route' | 'arrived' | 'in_progress']
  if (!label) return null

  function handleAdvance() {
    setError('')
    startTransition(async () => {
      const result = await driverAdvanceTripAction(bookingId)
      if (!result.success) setError(result.error ?? 'Error')
    })
  }

  function handleNoShow() {
    setError('')
    startTransition(async () => {
      const result = await driverNoShowAction(bookingId)
      if (!result.success) {
        setError(result.error ?? 'Error')
        setConfirmNoShow(false)
      }
    })
  }

  return (
    <div className="space-y-2.5">
      <button
        onClick={handleAdvance}
        disabled={isPending}
        className="w-full py-3.5 text-sm font-semibold bg-gold text-gray-900 rounded-xl hover:bg-gold/90 disabled:opacity-50 transition-colors shadow-sm"
      >
        {isPending ? labels.saving : label}
      </button>

      {/* No-show: solo cuando el conductor ya llegó al punto */}
      {status === 'arrived' && (
        confirmNoShow ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
            <p className="text-xs text-red-700">{labels.noShowQ}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmNoShow(false)}
                disabled={isPending}
                className="flex-1 py-2 text-xs font-medium border border-[#e5e1d8] rounded-lg text-[#75716a] hover:bg-white transition-colors"
              >
                {labels.back}
              </button>
              <button
                onClick={handleNoShow}
                disabled={isPending}
                className="flex-1 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? labels.saving : labels.noShowConfirm}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmNoShow(true)}
            disabled={isPending}
            className="w-full py-2.5 text-xs font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {labels.noShow}
          </button>
        )
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
