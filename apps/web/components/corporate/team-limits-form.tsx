'use client'
// ── Autogestión de límites del equipo — solo el manager corporativo ───────────

import { useState, useTransition } from 'react'
import { updateCorporateMemberLimitsAction } from '@/app/actions/corporate'
import type { Dictionary } from '@/lib/i18n/server'

type T = Dictionary['corporate']['dashboard']['team']

interface Member {
  id: string
  name: string
  role: 'manager' | 'user'
  spendingLimit: number | null
  monthlyLimit: number | null
  isSelf: boolean
}

const inputCls =
  'w-24 text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-2 py-1.5 ' +
  'text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'

function MemberRow({ member, t }: { member: Member; t: T }) {
  const [spendingLimit, setSpendingLimit] = useState(member.spendingLimit?.toString() ?? '')
  const [monthlyLimit, setMonthlyLimit] = useState(member.monthlyLimit?.toString() ?? '')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setError('')
    setSaved(false)
    const fd = new FormData()
    fd.set('spending_limit', spendingLimit)
    fd.set('monthly_limit', monthlyLimit)
    startTransition(async () => {
      const result = await updateCorporateMemberLimitsAction(member.id, fd)
      if (!result.success) {
        setError(result.error ?? t.error)
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  if (member.isSelf) {
    return (
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-sm font-medium text-sl-on-surface">{member.name} <span className="text-xs text-sl-on-surface-muted font-normal">{t.you}</span></p>
          <p className="text-xs text-sl-on-surface-muted">{t.roleManager}</p>
        </div>
        <p className="text-xs text-sl-on-surface-muted">
          {member.spendingLimit != null ? `$${member.spendingLimit}` : t.noLimit}
          {' · '}
          {member.monthlyLimit != null ? `$${member.monthlyLimit}` : t.noLimit}
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-medium text-sl-on-surface">{member.name}</p>
          <p className="text-xs text-sl-on-surface-muted">{member.role === 'manager' ? t.roleManager : t.roleUser}</p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-[10px] text-sl-on-surface-muted mb-1">{t.perTrip}</label>
            <input
              type="number" step="0.01" min="0" placeholder={t.noLimit}
              value={spendingLimit} onChange={(e) => setSpendingLimit(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[10px] text-sl-on-surface-muted mb-1">{t.perMonth}</label>
            <input
              type="number" step="0.01" min="0" placeholder={t.noLimit}
              value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)}
              className={inputCls}
            />
          </div>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="px-3 py-1.5 text-xs font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 disabled:opacity-50 transition-colors"
          >
            {isPending ? t.saving : saved ? t.saved : t.save}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function TeamLimitsForm({
  members, creditLimit, assignedTotal, t,
}: {
  members: Member[]
  creditLimit: number
  assignedTotal: number
  t: T
}) {
  const available = Math.max(0, creditLimit - assignedTotal)

  return (
    <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-4 border-b border-sl-outline-variant">
        <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-1">{t.title}</p>
        {creditLimit > 0 ? (
          <p className="text-xs text-sl-on-surface-muted">
            {t.creditLabel}: <span className="font-medium text-sl-on-surface">${creditLimit.toFixed(2)}</span>
            {' · '}{t.assignedLabel}: <span className="font-medium text-sl-on-surface">${assignedTotal.toFixed(2)}</span>
            {' · '}{t.availableLabel}: <span className="font-medium text-bronze">${available.toFixed(2)}</span>
          </p>
        ) : (
          <p className="text-xs text-sl-on-surface-muted">{t.noCredit}</p>
        )}
      </div>
      <div className="divide-y divide-sl-outline-variant">
        {members.map((m) => <MemberRow key={m.id} member={m} t={t} />)}
      </div>
    </div>
  )
}
