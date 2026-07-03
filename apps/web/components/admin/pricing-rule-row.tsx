'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { updatePricingRuleAction } from '@/app/actions/pricing'
import { PricingRuleActiveToggle, PricingRuleDeleteButton } from './pricing-controls'
import { ZoneSelectFields } from './zone-select-fields'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import type { PricingModel } from '@/lib/supabase/database.types'

type PricingDict = Dictionary['admin']['pricing']
type ActionsDict = Dictionary['admin']['actions']

const MODEL_BADGE: Record<PricingModel, string> = {
  flat_rate:  'bg-blue-50 text-blue-700 border-blue-200',
  per_mile:   'bg-green-50 text-green-700 border-green-200',
  per_km:     'bg-teal-50 text-teal-700 border-teal-200',
  hourly:     'bg-purple-50 text-purple-700 border-purple-200',
  zone_based: 'bg-amber-50 text-amber-700 border-amber-200',
}

interface Rule {
  id: string
  name: string
  model: string
  vehicle_type_id: string | null
  base_price: number | string | null
  per_mile_rate: number | string | null
  per_km_rate: number | string | null
  hourly_rate: number | string | null
  minimum_fare: number | string | null
  origin_zone_id: string | null
  destination_zone_id: string | null
  airport_pickup_fee: number | string | null
  airport_dropoff_fee: number | string | null
  night_surcharge_pct: number | string | null
  weekend_surcharge_pct: number | string | null
  holiday_surcharge_pct: number | string | null
  surge_enabled: boolean | null
  surge_multiplier: number | string | null
  priority: number | null
  is_active: boolean
}

const inputCls =
  'w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface ' +
  'placeholder:text-sl-on-surface-muted/50 focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'

const num = (v: number | string | null): number => (v == null ? 0 : Number(v))

export function PricingRuleRow({
  rule,
  vehicleTypes,
  zones,
  vtName,
  t,
  actions,
}: {
  rule: Rule
  vehicleTypes: { id: string; name: string }[]
  zones: { id: string; name: string }[]
  vtName: string | null
  t: PricingDict
  actions: ActionsDict
}) {
  const [editing, setEditing] = useState(false)
  const [model, setModel] = useState(rule.model)
  const [isPending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErr(null)
    startTransition(async () => {
      const res = await updatePricingRuleAction(rule.id, fd)
      if (res.success) setEditing(false)
      else setErr(res.error ?? 'Error')
    })
  }

  if (editing) {
    return (
      <tr className="bg-sl-bg/40">
        <td colSpan={7} className="px-5 py-4">
          <form onSubmit={handleSubmit}>
            {/* Campos no editables aquí — se preservan tal cual */}
            <input type="hidden" name="airport_pickup_fee" defaultValue={num(rule.airport_pickup_fee)} />
            <input type="hidden" name="airport_dropoff_fee" defaultValue={num(rule.airport_dropoff_fee)} />
            <input type="hidden" name="holiday_surcharge_pct" defaultValue={num(rule.holiday_surcharge_pct)} />
            <input type="hidden" name="surge_enabled" defaultValue={rule.surge_enabled ? 'true' : 'false'} />
            <input type="hidden" name="surge_multiplier" defaultValue={num(rule.surge_multiplier) || 1} />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.ruleName}</label>
                <input name="name" defaultValue={rule.name} required className={inputCls} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.model}</label>
                <select name="model" value={model} onChange={(e) => setModel(e.target.value as PricingModel)} required className={inputCls}>
                  {Object.entries(t.models).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              {model === 'zone_based' && (
                <ZoneSelectFields
                  zones={zones}
                  inputCls={inputCls}
                  defaultOriginZoneId={rule.origin_zone_id}
                  defaultDestinationZoneId={rule.destination_zone_id}
                  labels={{
                    originZone: t.originZone,
                    destinationZone: t.destinationZone,
                    selectZone: t.selectZone,
                    helpOriginZone: t.help.originZone,
                    helpDestinationZone: t.help.destinationZone,
                  }}
                />
              )}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.vehicleType}</label>
                <select name="vehicle_type_id" defaultValue={rule.vehicle_type_id ?? ''} className={inputCls}>
                  <option value="">{t.allVehicleTypes}</option>
                  {vehicleTypes.map((vt) => (
                    <option key={vt.id} value={vt.id}>{vt.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.priority}</label>
                <input name="priority" type="number" min="0" defaultValue={rule.priority ?? 0} className={inputCls} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.basePrice}</label>
                <input name="base_price" type="number" step="0.01" min="0" defaultValue={num(rule.base_price)} className={inputCls} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.perMileRate}</label>
                <input name="per_mile_rate" type="number" step="0.0001" min="0" defaultValue={num(rule.per_mile_rate)} className={inputCls} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.perKmRate}</label>
                <input name="per_km_rate" type="number" step="0.0001" min="0" defaultValue={num(rule.per_km_rate)} className={inputCls} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.hourlyRate}</label>
                <input name="hourly_rate" type="number" step="0.01" min="0" defaultValue={num(rule.hourly_rate)} className={inputCls} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.minimumFare}</label>
                <input name="minimum_fare" type="number" step="0.01" min="0" defaultValue={num(rule.minimum_fare)} className={inputCls} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.nightSurcharge}</label>
                <input name="night_surcharge_pct" type="number" step="0.01" min="0" defaultValue={num(rule.night_surcharge_pct)} className={inputCls} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.weekendSurcharge}</label>
                <input name="weekend_surcharge_pct" type="number" step="0.01" min="0" defaultValue={num(rule.weekend_surcharge_pct)} className={inputCls} />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-3">
              <button type="submit" disabled={isPending} className="px-4 py-2 text-sm font-semibold bg-gold text-gray-900 rounded-lg hover:bg-gold/90 disabled:opacity-60 transition-all">
                {isPending ? actions.saving : actions.save}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="text-xs text-sl-on-surface-muted hover:text-sl-on-surface">
                {actions.cancel}
              </button>
            </div>
          </form>
          {err && <p className="mt-2 text-xs text-red-500">{err}</p>}
        </td>
      </tr>
    )
  }

  return (
    <tr className="hover:bg-sl-bg/40 transition-colors">
      <td className="px-5 py-3.5">
        <p className="font-medium text-sl-on-surface">{rule.name}</p>
        <p className="text-xs text-sl-on-surface-muted mt-0.5">{vtName ?? t.allVehicleTypes}</p>
      </td>
      <td className="px-5 py-3.5">
        <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${MODEL_BADGE[rule.model as PricingModel] ?? ''}`}>
          {t.models[rule.model as PricingModel] ?? rule.model}
        </span>
      </td>
      <td className="px-5 py-3.5 text-right font-medium text-sl-on-surface">
        ${num(rule.base_price).toFixed(2)}
      </td>
      <td className="px-5 py-3.5 text-right text-sl-on-surface-muted">
        {rule.minimum_fare ? `$${num(rule.minimum_fare).toFixed(2)}` : '—'}
      </td>
      <td className="px-5 py-3.5 text-center">
        <span className="text-xs font-mono text-sl-on-surface-muted">{rule.priority ?? 0}</span>
      </td>
      <td className="px-5 py-3.5">
        <PricingRuleActiveToggle ruleId={rule.id} isActive={rule.is_active} />
      </td>
      <td className="px-5 py-3.5 text-right">
        <div className="flex items-center justify-end gap-3">
          <button onClick={() => setEditing(true)} className="text-xs font-medium text-bronze hover:text-bronze/80 transition-colors">
            {actions.edit}
          </button>
          <PricingRuleDeleteButton ruleId={rule.id} />
        </div>
      </td>
    </tr>
  )
}
