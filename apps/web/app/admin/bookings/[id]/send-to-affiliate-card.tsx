'use client'
// ── Sección G — Enviar reserva a un afiliado (tarjeta en el detalle del booking) ─

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  sendBookingToAffiliateAction,
  cancelAffiliateTripAction,
  resolveCounterOfferAction,
} from '@/app/actions/affiliates'
import { isOperating } from '@/lib/affiliates/engine'
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
  activeTrip: ActiveAffiliateTrip | null
  myCompanyId: string
  t: T
}

const REASONS: AffiliateReason[] = ['no_driver', 'out_of_zone', 'overcapacity', 'better_affiliate_rate', 'other']
const BRANDING_MODES: BrandingMode[] = ['white_label', 'operated_by', 'co_branded']

export function SendToAffiliateCard({ bookingId, enabled, affiliates, activeTrip, myCompanyId, t }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [companyAffiliateId, setCompanyAffiliateId] = useState(affiliates[0]?.companyAffiliateId ?? '')
  const [reason, setReason] = useState<AffiliateReason>('no_driver')
  const [price, setPrice] = useState('')
  const [branding, setBranding] = useState<BrandingMode>('white_label')

  if (!enabled) return null

  function submit() {
    setError('')
    const offeredPrice = Number(price)
    if (!companyAffiliateId || !Number.isFinite(offeredPrice) || offeredPrice < 0) {
      setError(t.send.priceLabel)
      return
    }
    startTransition(async () => {
      const result = await sendBookingToAffiliateAction({ bookingId, companyAffiliateId, reason, offeredPrice, brandingMode: branding })
      if (!result.success) setError(result.error ?? 'Error')
      else setPrice('')
    })
  }

  function cancel() {
    if (!activeTrip) return
    setError('')
    startTransition(async () => {
      const result = await cancelAffiliateTripAction(activeTrip.id)
      if (!result.success) setError(result.error ?? 'Error')
    })
  }

  function resolveCounter(accept: boolean) {
    if (!activeTrip) return
    setError('')
    startTransition(async () => {
      const result = await resolveCounterOfferAction(activeTrip.id, accept)
      if (!result.success) setError(result.error ?? 'Error')
    })
  }

  if (activeTrip) {
    const canCancel = ['requested', 'countered', 'accepted'].includes(activeTrip.status)
    return (
      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.send.activeTitle}</p>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-bronze/10 text-bronze">
            {t.status[activeTrip.status as keyof T['status']] ?? activeTrip.status}
          </span>
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

        {activeTrip.status === 'countered' && activeTrip.counteredPrice != null && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 space-y-2">
            <p className="text-sm text-amber-800">{t.send.counterReceived} ${Number(activeTrip.counteredPrice).toFixed(2)}</p>
            <div className="flex gap-2">
              <button onClick={() => resolveCounter(true)} disabled={isPending} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                {t.send.acceptCounter}
              </button>
              <button onClick={() => resolveCounter(false)} disabled={isPending} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-sl-outline-variant hover:bg-sl-bg">
                {t.send.rejectCounter}
              </button>
            </div>
          </div>
        )}

        {canCancel && (
          <button onClick={cancel} disabled={isPending} className="text-xs text-red-600 hover:underline disabled:opacity-50">
            {t.send.cancel}
          </button>
        )}
        {(isOperating(activeTrip.status as never) || activeTrip.status === 'completed') && (
          <AffiliateChat companyAffiliateId={activeTrip.companyAffiliateId} affiliateTripId={activeTrip.id} myCompanyId={myCompanyId} t={t.chat} />
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    )
  }

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
            <select value={companyAffiliateId} onChange={(e) => setCompanyAffiliateId(e.target.value)} className="w-full rounded-xl border border-sl-outline-variant bg-white px-3 py-2 text-sm">
              {affiliates.map((a) => <option key={a.companyAffiliateId} value={a.companyAffiliateId}>{a.name}</option>)}
            </select>
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
          <button onClick={submit} disabled={isPending} className="px-4 py-2 bg-[#0071e3] text-white text-sm font-medium rounded-xl hover:bg-[#0077ed] disabled:opacity-50 transition-colors">
            {isPending ? '...' : t.send.submit}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
