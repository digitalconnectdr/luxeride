'use client'
// ── Autogestión de límites del equipo — solo el manager corporativo ───────────

import { useState, useTransition } from 'react'
import { updateCorporateMemberLimitsAction } from '@/app/actions/corporate'

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

function MemberRow({ member }: { member: Member }) {
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
        setError(result.error ?? 'Error al guardar')
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
          <p className="text-sm font-medium text-sl-on-surface">{member.name} <span className="text-xs text-sl-on-surface-muted font-normal">(tú)</span></p>
          <p className="text-xs text-sl-on-surface-muted">Manager</p>
        </div>
        <p className="text-xs text-sl-on-surface-muted">
          {member.spendingLimit != null ? `$${member.spendingLimit}/viaje` : 'Sin límite/viaje'}
          {' · '}
          {member.monthlyLimit != null ? `$${member.monthlyLimit}/mes` : 'Sin límite/mes'}
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-medium text-sl-on-surface">{member.name}</p>
          <p className="text-xs text-sl-on-surface-muted capitalize">{member.role === 'manager' ? 'Manager' : 'Usuario'}</p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-[10px] text-sl-on-surface-muted mb-1">Límite / viaje</label>
            <input
              type="number" step="0.01" min="0" placeholder="Sin límite"
              value={spendingLimit} onChange={(e) => setSpendingLimit(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[10px] text-sl-on-surface-muted mb-1">Límite / mes</label>
            <input
              type="number" step="0.01" min="0" placeholder="Sin límite"
              value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)}
              className={inputCls}
            />
          </div>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="px-3 py-1.5 text-xs font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar'}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function TeamLimitsForm({
  members, creditLimit, assignedTotal,
}: {
  members: Member[]
  creditLimit: number
  assignedTotal: number
}) {
  const available = Math.max(0, creditLimit - assignedTotal)

  return (
    <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-4 border-b border-sl-outline-variant">
        <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-1">Mi equipo</p>
        {creditLimit > 0 ? (
          <p className="text-xs text-sl-on-surface-muted">
            Crédito de la cuenta: <span className="font-medium text-sl-on-surface">${creditLimit.toFixed(2)}</span>
            {' · '}Asignado: <span className="font-medium text-sl-on-surface">${assignedTotal.toFixed(2)}</span>
            {' · '}Disponible: <span className="font-medium text-bronze">${available.toFixed(2)}</span>
          </p>
        ) : (
          <p className="text-xs text-sl-on-surface-muted">
            Tu empresa de transporte aún no configuró un crédito para esta cuenta.
          </p>
        )}
      </div>
      <div className="divide-y divide-sl-outline-variant">
        {members.map((m) => <MemberRow key={m.id} member={m} />)}
      </div>
    </div>
  )
}
