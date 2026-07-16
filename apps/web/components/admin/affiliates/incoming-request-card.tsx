'use client'
// ── Sección G — Tarjeta de solicitud entrante (responder, asignar, operar, liquidar) ─

import { useState, useTransition } from 'react'
import {
  respondToAffiliateTripAction,
  assignAffiliateDriverAction,
  advanceAffiliateTripAction,
  updateAffiliateSettlementAction,
} from '@/app/actions/affiliates'
import { nextOperationalStatus, isOperating } from '@/lib/affiliates/engine'
import { AffiliateChat } from './affiliate-chat'
import type { Dictionary } from '@/lib/i18n/server'

type T = Dictionary['affiliates']

export interface IncomingRequest {
  id: string
  companyAffiliateId: string
  ownerName: string
  status: string
  reason: string
  zone: string | null
  scheduledAt: string
  vehicleType: string | null
  passengerCount: number
  distanceMiles: number | null
  offeredPrice: number
  expiresAt: string
  driverId: string | null
  vehicleId: string | null
  settlementStatus: string
  settlementMethod: string | null
  settlementNotes: string | null
}

export interface DriverOption { id: string; name: string }
export interface VehicleOption { id: string; label: string }

interface Props {
  request: IncomingRequest
  drivers: DriverOption[]
  vehicles: VehicleOption[]
  localeTag: string
  myCompanyId: string
  t: T
}

export function IncomingRequestCard({ request, drivers, vehicles, localeTag, myCompanyId, t }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [showCounter, setShowCounter] = useState(false)
  const [counterPrice, setCounterPrice] = useState('')
  const [driverId, setDriverId] = useState(request.driverId ?? '')
  const [vehicleId, setVehicleId] = useState(request.vehicleId ?? '')
  const [settlementStatus, setSettlementStatus] = useState(request.settlementStatus)
  const [settlementMethod, setSettlementMethod] = useState(request.settlementMethod ?? '')
  const [settlementNotes, setSettlementNotes] = useState(request.settlementNotes ?? '')

  const expired = new Date(request.expiresAt).getTime() < Date.now()
  const canRespond = request.status === 'requested' && !expired

  function respond(decision: 'accept' | 'reject' | 'counter') {
    setError('')
    startTransition(async () => {
      const result = await respondToAffiliateTripAction({
        affiliateTripId: request.id,
        decision,
        counteredPrice: decision === 'counter' ? Number(counterPrice) : undefined,
      })
      if (!result.success) setError(result.error ?? 'Error')
      else setShowCounter(false)
    })
  }

  function assign() {
    if (!driverId || !vehicleId) return
    setError('')
    startTransition(async () => {
      const result = await assignAffiliateDriverAction({ affiliateTripId: request.id, driverId, vehicleId })
      if (!result.success) setError(result.error ?? 'Error')
    })
  }

  function advance() {
    setError('')
    startTransition(async () => {
      const result = await advanceAffiliateTripAction(request.id)
      if (!result.success) setError(result.error ?? 'Error')
    })
  }

  function saveSettlement() {
    setError('')
    startTransition(async () => {
      const result = await updateAffiliateSettlementAction({
        affiliateTripId: request.id,
        status: settlementStatus as 'pending' | 'invoiced' | 'paid' | 'disputed',
        method: settlementMethod || undefined,
        notes: settlementNotes || undefined,
      })
      if (!result.success) setError(result.error ?? 'Error')
    })
  }

  const next = nextOperationalStatus(request.status as never)
  const hasDriverAssigned = !!request.driverId

  return (
    <div className="border border-sl-outline-variant rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-medium text-sl-on-surface">{t.requests.from}: {request.ownerName}</p>
          <p className="text-xs text-sl-on-surface-muted mt-0.5">{new Date(request.scheduledAt).toLocaleString(localeTag, { dateStyle: 'medium', timeStyle: 'short' })}</p>
        </div>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-bronze/10 text-bronze">
          {t.status[request.status as keyof T['status']] ?? request.status}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div><p className="text-sl-on-surface-muted">{t.requests.zone}</p><p className="text-sl-on-surface mt-0.5">{request.zone ?? '—'}</p></div>
        <div><p className="text-sl-on-surface-muted">{t.requests.vehicleType}</p><p className="text-sl-on-surface mt-0.5">{request.vehicleType ?? '—'}</p></div>
        <div><p className="text-sl-on-surface-muted">{t.requests.passengers}</p><p className="text-sl-on-surface mt-0.5">{request.passengerCount}</p></div>
        <div><p className="text-sl-on-surface-muted">{t.requests.distance}</p><p className="text-sl-on-surface mt-0.5">{request.distanceMiles != null ? `${request.distanceMiles} mi` : '—'}</p></div>
      </div>

      <p className="text-sm text-sl-on-surface">{t.requests.offeredPrice}: <span className="font-medium">${request.offeredPrice.toFixed(2)}</span></p>

      {canRespond && !showCounter && (
        <div className="flex gap-2">
          <button onClick={() => respond('accept')} disabled={isPending} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">{t.requests.accept}</button>
          <button onClick={() => respond('reject')} disabled={isPending} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-sl-outline-variant hover:bg-sl-bg">{t.requests.reject}</button>
          <button onClick={() => setShowCounter(true)} disabled={isPending} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-sl-outline-variant hover:bg-sl-bg">{t.requests.counter}</button>
        </div>
      )}

      {canRespond && showCounter && (
        <div className="flex gap-2 items-end">
          <div>
            <label className="block text-xs text-sl-on-surface-muted mb-1">{t.requests.counterPriceLabel}</label>
            <input type="number" min={0} step="0.01" value={counterPrice} onChange={(e) => setCounterPrice(e.target.value)} className="w-32 rounded-lg border border-sl-outline-variant bg-white px-2.5 py-1.5 text-xs" />
          </div>
          <button onClick={() => respond('counter')} disabled={isPending} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gold text-gray-900 hover:bg-gold/90 disabled:opacity-50">{t.requests.counterSubmit}</button>
        </div>
      )}

      {request.status === 'countered' && <p className="text-xs text-amber-700">{t.requests.counterPending}</p>}

      {request.status === 'accepted' && !hasDriverAssigned && (
        <div className="space-y-2 pt-2 border-t border-sl-outline-variant">
          <p className="text-xs font-semibold text-sl-on-surface-muted uppercase tracking-widest">{t.requests.assignTitle}</p>
          <div className="grid grid-cols-2 gap-2">
            <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="rounded-lg border border-sl-outline-variant bg-white px-2.5 py-1.5 text-xs">
              <option value="">{t.requests.driverLabel}</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="rounded-lg border border-sl-outline-variant bg-white px-2.5 py-1.5 text-xs">
              <option value="">{t.requests.vehicleLabel}</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </div>
          <button onClick={assign} disabled={isPending || !driverId || !vehicleId} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gold text-gray-900 hover:bg-gold/90 disabled:opacity-50">
            {t.requests.assignSubmit}
          </button>
        </div>
      )}

      {hasDriverAssigned && isOperating(request.status as never) && next && (
        <button onClick={advance} disabled={isPending} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gold text-gray-900 hover:bg-gold/90 disabled:opacity-50">
          {t.requests.advance[next as keyof T['requests']['advance']]}
        </button>
      )}

      {request.status === 'completed' && (
        <div className="space-y-2 pt-2 border-t border-sl-outline-variant">
          <p className="text-xs font-semibold text-sl-on-surface-muted uppercase tracking-widest">{t.requests.settlementTitle}</p>
          <div className="grid grid-cols-2 gap-2">
            <select value={settlementStatus} onChange={(e) => setSettlementStatus(e.target.value)} className="rounded-lg border border-sl-outline-variant bg-white px-2.5 py-1.5 text-xs">
              {(['pending', 'invoiced', 'paid', 'disputed'] as const).map((s) => <option key={s} value={s}>{t.settlementStatus[s]}</option>)}
            </select>
            <input value={settlementMethod} onChange={(e) => setSettlementMethod(e.target.value)} placeholder={t.requests.settlementMethodPlaceholder} className="rounded-lg border border-sl-outline-variant bg-white px-2.5 py-1.5 text-xs" />
          </div>
          <textarea value={settlementNotes} onChange={(e) => setSettlementNotes(e.target.value)} rows={2} placeholder={t.requests.settlementNotes} className="w-full rounded-lg border border-sl-outline-variant bg-white px-2.5 py-1.5 text-xs resize-none" />
          <button onClick={saveSettlement} disabled={isPending} className="px-3 py-1.5 text-xs font-medium border border-sl-outline-variant rounded-lg hover:bg-sl-bg disabled:opacity-50">
            {t.requests.settlementSave}
          </button>
        </div>
      )}

      {(isOperating(request.status as never) || request.status === 'completed') && (
        <AffiliateChat companyAffiliateId={request.companyAffiliateId} affiliateTripId={request.id} myCompanyId={myCompanyId} t={t.chat} />
      )}

      {expired && request.status === 'requested' && <p className="text-xs text-red-600">{t.requests.expired}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
