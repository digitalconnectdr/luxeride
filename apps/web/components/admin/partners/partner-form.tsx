'use client'
// ── Formulario de alta/edición de un Partner Portal ─────────────────────────────

import { useRef, useState, useTransition } from 'react'
import { createPartnerAction, updatePartnerAction } from '@/app/actions/partners'
import type { Dictionary } from '@/lib/i18n/server'

type T = Dictionary['admin']['partners']

const inputCls =
  'w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 ' +
  'text-sl-on-surface placeholder:text-sl-on-surface-muted/50 ' +
  'focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'
const labelCls = 'block text-xs text-sl-on-surface-muted mb-1'

export interface ExistingPartner {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  rateAdjustmentPct: number
  commissionType: 'percentage' | 'fixed'
  commissionValue: number
}

export function PartnerForm({ t, partner, onSaved }: { t: T; partner?: ExistingPartner; onSaved?: () => void }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [commissionType, setCommissionType] = useState<'percentage' | 'fixed'>(partner?.commissionType ?? 'percentage')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = partner ? await updatePartnerAction(partner.id, fd) : await createPartnerAction(fd)
      if (!result.success) { setError(result.error ?? 'Error'); return }
      if (!partner) formRef.current?.reset()
      onSaved?.()
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6 space-y-4">
      <h2 className="text-sm font-semibold text-sl-on-surface">{partner ? t.editPartner : t.newPartner}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{t.name}</label>
          <input name="name" required maxLength={120} defaultValue={partner?.name} className={inputCls} placeholder="Brickell Hotel" />
        </div>
        {!partner && (
          <div>
            <label className={labelCls}>{t.slug} <span className="normal-case">({t.optional})</span></label>
            <input name="slug" maxLength={60} className={inputCls} placeholder="brickell-hotel-vip" />
          </div>
        )}
        <div>
          <label className={labelCls}>{t.logoUrl} <span className="normal-case">({t.optional})</span></label>
          <input name="logo_url" type="url" defaultValue={partner?.logoUrl ?? undefined} className={inputCls} placeholder="https://…" />
        </div>
        <div>
          <label className={labelCls}>{t.contactName} <span className="normal-case">({t.optional})</span></label>
          <input name="contact_name" defaultValue={partner?.contactName ?? undefined} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.contactEmail} <span className="normal-case">({t.optional})</span></label>
          <input name="contact_email" type="email" defaultValue={partner?.contactEmail ?? undefined} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.contactPhone} <span className="normal-case">({t.optional})</span></label>
          <input name="contact_phone" defaultValue={partner?.contactPhone ?? undefined} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.rateAdjustment}</label>
          <input
            name="rate_adjustment_pct"
            type="number"
            step="0.5"
            min="-50"
            max="50"
            defaultValue={partner?.rateAdjustmentPct ?? 0}
            className={inputCls}
          />
          <p className="text-[11px] text-sl-on-surface-muted mt-1">{t.rateAdjustmentHint}</p>
        </div>
        <div>
          <label className={labelCls}>{t.commissionType}</label>
          <select
            name="commission_type"
            value={commissionType}
            onChange={(e) => setCommissionType(e.target.value as 'percentage' | 'fixed')}
            className={inputCls}
          >
            <option value="percentage">{t.percentage}</option>
            <option value="fixed">{t.fixed}</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>{t.commissionValue} {commissionType === 'percentage' ? '(%)' : '($)'}</label>
          <input
            name="commission_value"
            type="number"
            step="0.01"
            min="0"
            defaultValue={partner?.commissionValue ?? 0}
            className={inputCls}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 text-sm font-medium bg-bronze text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {isPending ? t.saving : partner ? t.saveChanges : t.create}
      </button>
    </form>
  )
}
