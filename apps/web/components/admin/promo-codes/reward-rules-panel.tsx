'use client'
// ── Reglas de recompensa automática ───────────────────────────────────────────
// Los códigos manuales de la otra pestaña hay que crearlos y repartirlos a
// mano. Esto los automatiza: se define una condición y el sistema genera un
// código personal cuando el cliente la cumple.
//
// NO hay disparador por puntuación de reseña, y es deliberado: Google prohíbe
// incentivar reseñas, y premiar notas altas volvería inútil `drivers.rating`,
// que es lo que usa el score de auto-asignación. Ver lib/rewards/engine.ts.

import { useState, useTransition, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import {
  createRewardRuleAction,
  setRewardRuleActiveAction,
  deleteRewardRuleAction,
} from '@/app/actions/promo-codes'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import type { RewardTrigger } from '@/lib/supabase/database.types'

type T = Dictionary['admin']['promoCodes']

export interface RewardRuleRow {
  id: string
  name: string
  trigger_type: RewardTrigger
  threshold: number | null
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  valid_days: number
  is_active: boolean
}

// Debe coincidir con TRIGGERS_WITHOUT_THRESHOLD en app/actions/promo-codes.ts
// y con el CHECK de la migración 79.
const NO_THRESHOLD: RewardTrigger[] = ['first_trip', 'review_submitted', 'birthday']

const inputCls =
  'w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface ' +
  'placeholder:text-sl-on-surface-muted/60 focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'
const labelCls = 'block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1'

export function RewardRulesPanel({ rules, t, currency }: { rules: RewardRuleRow[]; t: T; currency: string }) {
  const [trigger, setTrigger] = useState<RewardTrigger>('trips_completed')
  const [isPending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  const needsThreshold = !NO_THRESHOLD.includes(trigger)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    setErr(null)
    startTransition(async () => {
      const res = await createRewardRuleAction(fd)
      if (res.success) form.reset()
      else setErr(res.error ?? 'Error')
    })
  }

  return (
    <div className="space-y-5">
      <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5">
        <h2 className="text-sm font-semibold text-sl-on-surface mb-1">{t.rulesAddTitle}</h2>
        <p className="text-xs text-sl-on-surface-muted mb-4 max-w-[75ch]">{t.rulesAddIntro}</p>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2">
              <label className={labelCls}>{t.ruleName}</label>
              <input name="name" required maxLength={120} placeholder={t.ruleNamePlaceholder} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>{t.ruleTrigger}</label>
              <select
                name="trigger_type"
                value={trigger}
                onChange={(e) => setTrigger(e.target.value as RewardTrigger)}
                className={inputCls}
              >
                <option value="trips_completed">{t.triggerTripsCompleted}</option>
                <option value="total_spent">{t.triggerTotalSpent}</option>
                <option value="first_trip">{t.triggerFirstTrip}</option>
                <option value="inactivity_days">{t.triggerInactivity}</option>
                <option value="review_submitted">{t.triggerReviewSubmitted}</option>
                <option value="birthday">{t.triggerBirthday}</option>
              </select>
            </div>

            {/* El umbral solo existe para los disparadores que lo miden. */}
            {needsThreshold && (
              <div>
                <label className={labelCls}>
                  {trigger === 'total_spent'
                    ? `${t.ruleThreshold} (${currency})`
                    : trigger === 'inactivity_days'
                      ? t.ruleThresholdDays
                      : t.ruleThresholdTrips}
                </label>
                <input
                  name="threshold"
                  type="number"
                  min="1"
                  step={trigger === 'total_spent' ? '0.01' : '1'}
                  required
                  className={inputCls}
                />
              </div>
            )}

            <div>
              <label className={labelCls}>{t.discountType}</label>
              <select name="discount_type" defaultValue="percentage" className={inputCls}>
                <option value="percentage">{t.percentage}</option>
                <option value="fixed">{t.fixed}</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>{t.discountValue}</label>
              <input name="discount_value" type="number" min="1" step="0.01" required className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>{t.ruleValidDays}</label>
              <input name="valid_days" type="number" min="1" max="730" defaultValue="90" className={inputCls} />
            </div>
          </div>

          <p className="mt-3 text-[11px] text-sl-on-surface-muted max-w-[75ch]">{t.rulesOncePerCustomer}</p>

          {err && <p className="mt-2 text-xs text-red-600">{err}</p>}

          <div className="flex justify-end mt-4">
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm font-semibold bg-gold text-gray-900 rounded-lg hover:bg-gold/90 disabled:opacity-60 transition-colors"
            >
              {isPending ? t.saving : t.rulesAddButton}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm overflow-hidden">
        {!rules.length ? (
          <p className="p-6 text-sm text-sl-on-surface-muted">{t.noRules}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold/20 text-left text-[10px] uppercase tracking-widest text-sl-on-surface-muted">
                  <th className="px-6 py-4 font-semibold">{t.ruleName}</th>
                  <th className="px-6 py-4 font-semibold">{t.ruleTrigger}</th>
                  <th className="px-6 py-4 font-semibold">{t.discountType}</th>
                  <th className="px-6 py-4 font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sl-outline-variant/50">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-sl-bg/40 transition-colors">
                    <td className="px-6 py-4 font-medium text-sl-on-surface">{r.name}</td>
                    <td className="px-6 py-4 text-sl-on-surface-muted">
                      {describeTrigger(r, t, currency)}
                    </td>
                    <td className="px-6 py-4 text-sl-on-surface">
                      {r.discount_type === 'percentage' ? `${r.discount_value}%` : `$${r.discount_value}`}
                      <span className="text-sl-on-surface-muted"> · {r.valid_days}d</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-3">
                        <ActiveToggle rule={r} t={t} />
                        <DeleteButton ruleId={r.id} name={r.name} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function describeTrigger(r: RewardRuleRow, t: T, currency: string): string {
  switch (r.trigger_type) {
    case 'first_trip':       return t.triggerFirstTrip
    case 'review_submitted': return t.triggerReviewSubmitted
    case 'trips_completed':  return `${t.triggerTripsCompleted} · ${r.threshold}`
    case 'total_spent':      return `${t.triggerTotalSpent} · ${currency} ${r.threshold}`
    case 'inactivity_days':  return `${t.triggerInactivity} · ${r.threshold}d`
    case 'birthday':         return t.triggerBirthday
    default:                 return r.trigger_type
  }
}

function ActiveToggle({ rule, t }: { rule: RewardRuleRow; t: T }) {
  const [isPending, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await setRewardRuleActiveAction(rule.id, !rule.is_active)
        })
      }
      className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-all disabled:opacity-60 ${
        rule.is_active
          ? 'text-green-700 border-green-300 bg-green-50 hover:bg-red-50 hover:text-red-600 hover:border-red-300'
          // gray-600 y no gray-500: sobre bg-gray-50 el 500 da 4.36:1, por
          // debajo del 4.5:1 que pide AA para texto de este tamaño.
          : 'text-gray-600 border-gray-300 bg-gray-50 hover:bg-green-50 hover:text-green-700 hover:border-green-300'
      }`}
    >
      {isPending ? '…' : rule.is_active ? t.active : t.inactive}
    </button>
  )
}

function DeleteButton({ ruleId, name }: { ruleId: string; name: string }) {
  const [isPending, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`¿Eliminar la regla "${name}"? Los códigos ya entregados siguen siendo válidos.`)) return
        startTransition(async () => {
          await deleteRewardRuleAction(ruleId)
        })
      }}
      title={name}
      aria-label={name}
      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
    >
      {isPending ? <span className="text-xs">…</span> : <Trash2 size={14} strokeWidth={2} />}
    </button>
  )
}
