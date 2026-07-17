'use client'
// ── F1.11 — Corporate Accounts: controles client-side ─────────────────────────

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createCorporateAccountAction,
  toggleCorporateAccountAction,
  addCorporateMemberAction,
  removeCorporateMemberAction,
} from '@/app/actions/corporate'
import type { Dictionary } from '@/lib/i18n/server'

type FormLabels = Dictionary['admin']['corporateForm']
type MemberLabels = Dictionary['admin']['corporateMember']
type ToggleLabels = { active: string; inactive: string }

const inputCls =
  'w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 ' +
  'text-sl-on-surface placeholder:text-sl-on-surface-muted/50 ' +
  'focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'

const labelCls = 'block text-xs text-sl-on-surface-muted mb-1'

// ─── Crear cuenta corporativa ─────────────────────────────────────────────────

export function CreateCorporateAccountForm({ labels: t }: { labels: FormLabels }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createCorporateAccountAction(fd)
      if (!result.success) {
        setError(result.error ?? t.errCreate)
        return
      }
      setOpen(false)
      if (result.data?.id) router.push(`/admin/corporate/${result.data.id}`)
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors"
      >
        {t.newAccountBtn}
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5 space-y-4 w-full"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-sl-on-surface">{t.newAccountTitle}</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-sl-on-surface-muted hover:text-red-500">
          {t.cancel}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={labelCls}>{t.clientCompanyName} *</label>
          <input name="name" required placeholder="Acme Corp" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.contact}</label>
          <input name="contact_name" placeholder="María García" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.contactEmail}</label>
          <input name="contact_email" type="email" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.billingEmail}</label>
          <input name="billing_email" type="email" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.phone}</label>
          <input name="phone" type="tel" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.taxId}</label>
          <input name="tax_id" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.creditLimitUsd}</label>
          <input name="credit_limit" type="number" min="0" step="100" defaultValue={0} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.paymentTermsDays}</label>
          <input name="payment_terms" type="number" min="0" defaultValue={30} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.billingCycle}</label>
          <select name="billing_cycle" defaultValue="monthly" className={inputCls}>
            <option value="weekly">{t.weekly}</option>
            <option value="bi_weekly">{t.biweekly}</option>
            <option value="monthly">{t.monthly}</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input name="require_approval" type="checkbox" value="true" className="w-4 h-4 rounded accent-bronze" />
        <span className="text-sm text-sl-on-surface">{t.requireApproval}</span>
      </label>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? t.creating : t.createAccount}
        </button>
      </div>
    </form>
  )
}

// ─── Toggle activa/inactiva ───────────────────────────────────────────────────

export function CorporateAccountToggle({
  accountId,
  isActive,
  labels,
}: {
  accountId: string
  isActive: boolean
  labels: ToggleLabels
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await toggleCorporateAccountAction(accountId, !isActive)
        })
      }
      className={[
        'text-xs font-medium px-2.5 py-1 rounded-lg border transition-all',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        isActive
          ? 'text-green-700 border-green-300 bg-green-50 hover:bg-red-50 hover:text-red-600 hover:border-red-300'
          : 'text-gray-500 border-gray-300 bg-gray-50 hover:bg-green-50 hover:text-green-700 hover:border-green-300',
      ].join(' ')}
    >
      {isPending ? '…' : isActive ? labels.active : labels.inactive}
    </button>
  )
}

// ─── Agregar miembro ──────────────────────────────────────────────────────────

export function AddCorporateMemberForm({ accountId, labels: t }: { accountId: string; labels: MemberLabels }) {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    const form = e.currentTarget
    const fd = new FormData(form)
    fd.set('account_id', accountId)
    startTransition(async () => {
      const result = await addCorporateMemberAction(fd)
      if (!result.success) {
        setError(result.error ?? t.errAdd)
        return
      }
      setSuccess(true)
      form.reset()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>{t.emailLabel}</label>
          <input name="email" type="email" required placeholder={t.emailPlaceholder} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.role}</label>
          <select name="role" defaultValue="user" className={inputCls}>
            <option value="user">{t.roleUser}</option>
            <option value="manager">{t.roleManager}</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>{t.costCenter}</label>
          <input name="cost_center" placeholder={t.costCenterPlaceholder} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.perTripLimitUsd}</label>
          <input name="spending_limit" type="number" min="0" step="10" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.monthlyLimitUsd}</label>
          <input name="monthly_limit" type="number" min="0" step="100" className={inputCls} />
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      )}
      {success && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
          {t.memberAdded}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? t.adding : t.addMemberBtn}
        </button>
      </div>
    </form>
  )
}

// ─── Quitar miembro ───────────────────────────────────────────────────────────

export function RemoveMemberButton({ memberId, labels: t }: { memberId: string; labels: Pick<MemberLabels, 'removeConfirm' | 'remove'> }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      disabled={isPending}
      onClick={() => {
        if (!window.confirm(t.removeConfirm)) return
        startTransition(async () => {
          await removeCorporateMemberAction(memberId)
        })
      }}
      className="text-xs text-red-500 hover:text-red-600 hover:underline disabled:opacity-50"
    >
      {isPending ? '…' : t.remove}
    </button>
  )
}
