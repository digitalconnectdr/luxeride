'use client'
// ── Formulario de alta de código promocional ───────────────────────────────────

import { useRef, useState, useTransition } from 'react'
import { createPromoCodeAction } from '@/app/actions/promo-codes'
import type { Dictionary } from '@/lib/i18n/server'

type T = Dictionary['admin']['promoCodes']

const inputCls =
  'w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 ' +
  'text-sl-on-surface placeholder:text-sl-on-surface-muted/50 ' +
  'focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'
const labelCls = 'block text-xs text-sl-on-surface-muted mb-1'

export function PromoCodeForm({ t }: { t: T }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createPromoCodeAction(fd)
      if (!result.success) { setError(result.error ?? 'Error'); return }
      formRef.current?.reset()
      setDiscountType('percentage')
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6 space-y-4">
      <h2 className="text-sm font-semibold text-sl-on-surface">{t.newCode}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{t.code}</label>
          <input name="code" required maxLength={40} className={`${inputCls} uppercase`} placeholder="SUMMER10" />
        </div>
        <div>
          <label className={labelCls}>{t.discountType}</label>
          <select
            name="discount_type"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
            className={inputCls}
          >
            <option value="percentage">{t.percentage}</option>
            <option value="fixed">{t.fixed}</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>{t.discountValue} {discountType === 'percentage' ? '(%)' : '($)'}</label>
          <input name="discount_value" type="number" step="0.01" min="0.01" required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.minBookingAmount} <span className="normal-case">({t.optional})</span></label>
          <input name="min_booking_amount" type="number" step="0.01" min="0" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.maxUses} <span className="normal-case">({t.optional})</span></label>
          <input name="max_uses" type="number" step="1" min="1" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.maxUsesPerCustomer} <span className="normal-case">({t.optional})</span></label>
          <input name="max_uses_per_customer" type="number" step="1" min="1" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.validFrom} <span className="normal-case">({t.optional})</span></label>
          <input name="valid_from" type="date" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.validUntil} <span className="normal-case">({t.optional})</span></label>
          <input name="valid_until" type="date" className={inputCls} />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 text-sm font-medium bg-bronze text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {isPending ? t.creating : t.create}
      </button>
    </form>
  )
}
