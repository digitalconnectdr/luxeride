'use client'
// ── Sección G — Enviar reserva a uno o varios afiliados (Fase 3: pools) ────────
// Sin ningún envío todavía: formulario con checkboxes (selecciona 1 o más).
// Con envío(s) pendientes de respuesta: lista de "pool" con el estado de cada
// afiliado, cancelar el pool completo, o resolver una contraoferta puntual.
// Con un afiliado ya aceptado: vista de detalle de siempre (chat, cancelar),
// más una lista chica de los que no ganaron el pool (si los hubo).

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  sendBookingToAffiliateAction,
  cancelAffiliateTripAction,
  cancelAffiliatePoolAction,
  resolveCounterOfferAction,
} from '@/app/actions/affiliates'
import { isOperating, isPendingResponse } from '@/lib/affiliates/engine'
import { AffiliateChat } from '@/components/admin/affiliates/affiliate-chat'
import type { AffiliateReason, BrandingMode } from '@/lib/affiliates/engine'
import type { Dictionary } from '@/lib/i18n/server'

type T = Dictionary['affiliates']

export interface AffiliateOption {
  companyAffiliateId: string
  name: string
}

export interface ActiveAffiliateTrip {
  id: string
  companyAffiliateId: string
  status: string
  affiliateName: string
  offeredPrice: number
  counteredPrice: number | null
  agreedPrice: number | null
  marginAmount: number | null
  currency: string
}

interface Props {
  bookingId: string
  enabled: boolean
  affiliates: AffiliateOption[]
  trips: ActiveAffiliateTrip[]
  myCompanyId: string
  t: T
}

const REASONS: AffiliateReason[] = ['no_driver', 'out_of_zone', 'overcapacity', 'better_affiliate_rate', 'other']
const BRANDING_MODES: BrandingMode[] = ['white_label', 'operated_by', 'co_branded']

function TripStatusBadge({ status, t }: { status: string; t: T }) {
  return (
    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-bronze/10 text-bronze whitespace-nowrap">
      {t.status[status as keyof T['status']] ?? status}
    </span>
  )
}

export function SendToAffiliateCard({ bookingId, enabled, affiliates, trips, myCompanyId, t }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [reason, setReason] = useState<AffiliateReason>('no_driver')
  const [price, setPrice] = useState('')
  const [branding, setBranding] = useState<BrandingMode>('white_label')

  if (!enabled) return null

  function toggleSelected(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function submit() {
    setError('')
    const offeredPrice = Number(price)
    if (!selected.length || !Number.isFinite(offeredPrice) || offeredPrice < 0) {
      setError(t.send.priceLabel)
      return
    }
    startTransition(async () => {
      const result = await sendBookingToAffiliateAction({
        bookingId,
        companyAffiliateIds: selected,
        reason,
        offeredPrice,
        brandingMode: branding,
      })
      if (!result.success) setError(result.error ?? 'Error')
      else { setPrice(''); setSelected([]) }
    })
  }

  function cancelPool() {
    setError('')
    startTransition(async () => {
      const result = await cancelAffiliatePoolAction(bookingId)
      if (!result.success) setError(result.error ?? 'Error')
    })
  }

  function cancelOne(tripId: string) {
    setError('')
    startTransition(async () => {
      const result = await cancelAffiliateTripAction(tripId)
      if (!result.success) setError(result.error ?? 'Error')
    })
  }

  function resolveCounter(tripId: string, accept: boolean) {
    setError('')
    startTransition(async () => {
      const result = await resolveCounterOfferAction(tripId, accept)
      if (!result.success) setError(result.error ?? 'Error')
    })
  }

  const activeTrip = trips.find((tr) => isOperating(tr.status as never) || tr.status === 'completed') ?? null
  const poolTrips = trips.filter((tr) => isPendingResponse(tr.status as never))
  const lostTrips = trips.filter((tr) => tr.status === 'lost')

  // ── Un afiliado ya ganó (aceptado/operando/completado) ──────────────────────
  if (activeTrip) {
    const canCancel = ['accepted'].includes(activeTrip.status)
    return (
      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.send.activeTitle}</p>
          <TripStatusBadge status={activeTrip.status} t={t} />
        </div>
        <p className="text-sm text-sl-on-surface">{activeTrip.affiliateName}</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-sl-on-surface-muted">{t.send.offeredPrice}</p>
            <p className="text-sl-on-surface mt-0.5">${Number(activeTrip.offeredPrice).toFixed(2)} {activeTrip.currency}</p>
          </div>
          {activeTrip.agreedPrice != null && (
            <div>
              <p className="text-xs text-sl-on-surface-muted">{t.send.agreedPrice}</p>
              <p className="text-sl-on-surface mt-0.5">${Number(activeTrip.agreedPrice).toFixed(2)}</p>
            </div>
          )}
          {activeTrip.marginAmount != null && (
            <div>
              <p className="text-xs text-sl-on-surface-muted">{t.send.margin}</p>
              <p className={`mt-0.5 font-medium ${activeTrip.marginAmount < 0 ? 'text-red-600' : 'text-sl-on-surface'}`}>
                ${Number(activeTrip.marginAmount).toFixed(2)}
              </p>
            </div>
          )}
        </div>

        {canCancel && (
          <button onClick={() => cancelOne(activeTrip.id)} disabled={isPending} className="text-xs text-red-600 hover:underline disabled:opacity-50">
            {t.send.cancel}
          </button>
        )}
        {(isOperating(activeTrip.status as never) || activeTrip.status === 'completed') && (
          <AffiliateChat companyAffiliateId={activeTrip.companyAffiliateId} affiliateTripId={activeTrip.id} myCompanyId={myCompanyId} t={t.chat} />
        )}

        {lostTrips.length > 0 && (
          <div className="pt-2 border-t border-sl-outline-variant space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.send.poolLostTitle}</p>
            {lostTrips.map((tr) => (
              <div key={tr.id} className="flex items-center justify-between text-xs text-sl-on-surface-muted">
                <span>{tr.affiliateName}</span>
                <TripStatusBadge status={tr.status} t={t} />
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    )
  }

  // ── Pool en curso: uno o varios afiliados todavía sin resolver ─────────────
  if (poolTrips.length > 0) {
    return (
      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.send.poolTitle}</p>
          <button onClick={cancelPool} disabled={isPending} className="text-xs text-red-600 hover:underline disabled:opacity-50">
            {t.send.poolCancelAll}
          </button>
        </div>
        <div className="space-y-2">
          {poolTrips.map((tr) => (
            <div key={tr.id} className="rounded-xl border border-sl-outline-variant p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-sl-on-surface">{tr.affiliateName}</p>
                <TripStatusBadge status={tr.status} t={t} />
              </div>
              <p className="text-xs text-sl-on-surface-muted">
                {t.send.offeredPrice}: ${Number(tr.offeredPrice).toFixed(2)} {tr.currency}
              </p>
              {tr.status === 'countered' && tr.counteredPrice != null && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 space-y-2">
                  <p className="text-xs text-amber-800">{t.send.counterReceived} ${Number(tr.counteredPrice).toFixed(2)}</p>
                  <div className="flex gap-2">
                    <button onClick={() => resolveCounter(tr.id, true)} disabled={isPending} className="px-3 py-1 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                      {t.send.acceptCounter}
                    </button>
                    <button onClick={() => resolveCounter(tr.id, false)} disabled={isPending} className="px-3 py-1 text-xs font-medium rounded-lg border border-sl-outline-variant hover:bg-sl-bg">
                      {t.send.rejectCounter}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    )
  }

  // ── Nada enviado todavía: formulario de envío (1 o varios) ─────────────────
  return (
    <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.send.title}</p>
      <p className="text-xs text-sl-on-surface-muted">{t.send.hint}</p>

      {affiliates.length === 0 ? (
        <p className="text-sm text-sl-on-surface-muted">
          {t.send.noAffiliates}{' '}
          <Link href="/admin/affiliates" className="text-bronze hover:underline">{t.send.manageLink}</Link>
        </p>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-sl-on-surface-muted mb-1">{t.send.affiliateLabel}</label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-xl border border-sl-outline-variant p-2">
              {affiliates.map((a) => (
                <label key={a.companyAffiliateId} className="flex items-center gap-2 text-sm text-sl-on-surface cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(a.companyAffiliateId)}
                    onChange={() => toggleSelected(a.companyAffiliateId)}
                    className="rounded border-sl-outline-variant"
                  />
                  {a.name}
                </label>
              ))}
            </div>
            {selected.length > 1 && <p className="text-[11px] text-bronze mt-1">{t.send.poolHint}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-sl-on-surface-muted mb-1">{t.send.reasonLabel}</label>
              <select value={reason} onChange={(e) => setReason(e.target.value as AffiliateReason)} className="w-full rounded-xl border border-sl-outline-variant bg-white px-3 py-2 text-sm">
                {REASONS.map((r) => <option key={r} value={r}>{t.reasons[r]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-sl-on-surface-muted mb-1">{t.send.priceLabel}</label>
              <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full rounded-xl border border-sl-outline-variant bg-white px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-sl-on-surface-muted mb-1">{t.send.brandingLabel}</label>
            <select value={branding} onChange={(e) => setBranding(e.target.value as BrandingMode)} className="w-full rounded-xl border border-sl-outline-variant bg-white px-3 py-2 text-sm">
              {BRANDING_MODES.map((m) => <option key={m} value={m}>{t.brandingOptions[m]}</option>)}
            </select>
          </div>
          <button onClick={submit} disabled={isPending || !selected.length} className="px-4 py-2 bg-gold text-gray-900 text-sm font-medium rounded-xl hover:bg-gold/90 disabled:opacity-50 transition-colors">
            {isPending ? '...' : t.send.submit}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
