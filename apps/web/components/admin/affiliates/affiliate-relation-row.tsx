'use client'
// ── Sección G — Fila de una relación de afiliación (aprobar/rechazar/revocar) ─

import { useState, useTransition } from 'react'
import {
  respondToAffiliationAction,
  revokeAffiliationAction,
  updateAffiliationTermsAction,
} from '@/app/actions/affiliates'
import { AffiliateChat } from './affiliate-chat'
import type { AffiliateReliability } from '@/lib/affiliates/engine'
import type { Dictionary } from '@/lib/i18n/server'

type T = Dictionary['affiliates']['relationships']
type ChatT = Dictionary['affiliates']['chat']
type PaymentTerms = 'due_on_receipt' | 'net_7' | 'net_15' | 'net_30'

export interface AffiliateRelation {
  id: string
  otherCompanyName: string
  status: 'pending' | 'approved' | 'rejected' | 'revoked'
  direction: 'incoming' | 'outgoing'
  coverageNotes: string | null
  paymentTerms: PaymentTerms
  reliability: AffiliateReliability | null
}

const PAYMENT_TERMS: PaymentTerms[] = ['due_on_receipt', 'net_7', 'net_15', 'net_30']

export function AffiliateRelationRow({
  relation,
  t,
  chatT,
  myCompanyId,
}: {
  relation: AffiliateRelation
  t: T
  chatT: ChatT
  myCompanyId: string
}) {
  const [isPending, startTransition] = useTransition()
  const [notes, setNotes] = useState(relation.coverageNotes ?? '')
  const [terms, setTerms] = useState<PaymentTerms>(relation.paymentTerms)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function respond(approve: boolean) {
    setError('')
    startTransition(async () => {
      const result = await respondToAffiliationAction(relation.id, approve)
      if (!result.success) setError(result.error ?? 'Error')
    })
  }

  function revoke() {
    setError('')
    startTransition(async () => {
      const result = await revokeAffiliationAction(relation.id)
      if (!result.success) setError(result.error ?? 'Error')
    })
  }

  function save() {
    setError(''); setSaved(false)
    startTransition(async () => {
      const result = await updateAffiliationTermsAction(relation.id, { coverageNotes: notes, paymentTerms: terms })
      if (!result.success) setError(result.error ?? 'Error')
      else setSaved(true)
    })
  }

  const statusBadge: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    revoked: 'bg-gray-50 text-gray-500 border-gray-200',
  }

  return (
    <div className="border border-sl-outline-variant rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-medium text-sl-on-surface">{relation.otherCompanyName}</p>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusBadge[relation.status]}`}>
          {relation.status === 'pending'
            ? (relation.direction === 'incoming' ? t.incomingLabel : t.outgoingLabel)
            : relation.status === 'approved' ? t.approve
              : relation.status === 'rejected' ? t.reject
                : t.revoke}
        </span>
      </div>

      {relation.reliability && (relation.reliability.completedCount > 0 || relation.reliability.responseRatePct != null) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-sl-on-surface-muted">
          {relation.reliability.responseRatePct != null && (
            <span>{t.reliabilityResponseRate}: <span className="text-sl-on-surface font-medium">{relation.reliability.responseRatePct}%</span></span>
          )}
          {relation.reliability.avgResponseMinutes != null && (
            <span>{t.reliabilityAvgResponse}: <span className="text-sl-on-surface font-medium">{relation.reliability.avgResponseMinutes} {t.reliabilityMinutes}</span></span>
          )}
          {relation.reliability.punctualityPct != null && (
            <span>{t.reliabilityPunctuality}: <span className="text-sl-on-surface font-medium">{relation.reliability.punctualityPct}%</span></span>
          )}
        </div>
      )}

      {relation.status === 'pending' && relation.direction === 'incoming' && (
        <div className="flex gap-2">
          <button onClick={() => respond(true)} disabled={isPending} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
            {t.approve}
          </button>
          <button onClick={() => respond(false)} disabled={isPending} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-sl-outline-variant hover:bg-sl-bg">
            {t.reject}
          </button>
        </div>
      )}

      {relation.status === 'approved' && (
        <div className="space-y-2 pt-2 border-t border-sl-outline-variant">
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-sl-on-surface-muted mb-1">{t.paymentTermsLabel}</label>
              <select value={terms} onChange={(e) => setTerms(e.target.value as PaymentTerms)} className="w-full rounded-lg border border-sl-outline-variant bg-white px-2.5 py-1.5 text-xs">
                {PAYMENT_TERMS.map((pt) => <option key={pt} value={pt}>{pt}</option>)}
              </select>
            </div>
            <button onClick={save} disabled={isPending} className="px-3 py-1.5 text-xs font-medium border border-sl-outline-variant rounded-lg hover:bg-sl-bg disabled:opacity-50">
              {t.save}
            </button>
            <button onClick={revoke} disabled={isPending} className="text-xs text-red-600 hover:underline ml-auto">
              {t.revoke}
            </button>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-sl-outline-variant bg-white px-2.5 py-1.5 text-xs resize-none"
          />
          {saved && <p className="text-xs text-green-600">{t.saved}</p>}
          <AffiliateChat companyAffiliateId={relation.id} myCompanyId={myCompanyId} t={chatT} />
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
