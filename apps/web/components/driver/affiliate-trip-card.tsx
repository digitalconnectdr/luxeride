'use client'
// ── Sección G — Tarjeta de viaje afiliado para el conductor (en /driver/trips) ─

import { useState, useTransition } from 'react'
import { advanceAffiliateTripAction } from '@/app/actions/affiliates'
import { nextOperationalStatus, isOperating } from '@/lib/affiliates/engine'
import type { Dictionary } from '@/lib/i18n/server'

type T = Dictionary['affiliates']

export interface AffiliateTripForDriver {
  id: string
  status: string
  ownerCompanyName: string
  pickupAddress: string
  dropoffAddress: string
  scheduledAt: string
}

export function AffiliateTripCard({ trip, localeTag, t }: { trip: AffiliateTripForDriver; localeTag: string; t: T }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const next = nextOperationalStatus(trip.status as never)

  function advance() {
    setError('')
    startTransition(async () => {
      const result = await advanceAffiliateTripAction(trip.id)
      if (!result.success) setError(result.error ?? 'Error')
    })
  }

  return (
    <div className="rounded-2xl border border-[#e5e1d8] bg-white p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8a6520]">{trip.ownerCompanyName}</p>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#8a6520]/10 text-[#8a6520]">
          {t.status[trip.status as keyof T['status']] ?? trip.status}
        </span>
      </div>
      <p className="text-sm text-[#1d1b18]">{trip.pickupAddress} → {trip.dropoffAddress}</p>
      <p className="text-xs text-[#75716a]">{new Date(trip.scheduledAt).toLocaleString(localeTag, { dateStyle: 'medium', timeStyle: 'short' })}</p>
      {isOperating(trip.status as never) && next && (
        <button onClick={advance} disabled={isPending} className="px-4 py-2 text-sm font-medium rounded-xl bg-[#1d1b18] text-white hover:opacity-90 disabled:opacity-50">
          {t.requests.advance[next as keyof T['requests']['advance']]}
        </button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
