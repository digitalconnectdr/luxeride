'use client'
// ── Select de modelo de precio + selects de zona condicionales ────────────────
// En el form de CREAR una regla, muestra el select de "Modelo" y, solo si se
// elige "Por zona", los selects de zona origen/destino debajo.

import { useState } from 'react'
import { InfoTip } from '@/components/ui/info-tip'
import { ZoneSelectFields } from './zone-select-fields'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type PricingDict = Dictionary['admin']['pricing']

const inputCls =
  'w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface ' +
  'focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'

export function PricingModelField({
  t,
  zones,
}: {
  t: PricingDict
  zones: { id: string; name: string }[]
}) {
  const [model, setModel] = useState('')

  return (
    <>
      <div>
        <label className="block text-xs text-sl-on-surface-muted mb-1">
          {t.model} *<InfoTip text={t.help.model} />
        </label>
        <select
          name="model"
          required
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className={inputCls}
        >
          <option value="">{t.selectModel}</option>
          {Object.entries(t.models).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {model === 'zone_based' && (
        <ZoneSelectFields
          zones={zones}
          inputCls={inputCls}
          labels={{
            originZone: t.originZone,
            destinationZone: t.destinationZone,
            selectZone: t.selectZone,
            helpOriginZone: t.help.originZone,
            helpDestinationZone: t.help.destinationZone,
          }}
        />
      )}

      {model === 'hourly' && (
        <>
          <div>
            <label className="block text-xs text-sl-on-surface-muted mb-1">
              {t.minimumHours}<InfoTip text={t.help.minimumHours} />
            </label>
            <input
              name="minimum_hours"
              type="number"
              step="0.5"
              min="0"
              defaultValue="0"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-sl-on-surface-muted mb-1">
              {t.includedMiles}<InfoTip text={t.help.includedMiles} />
            </label>
            <input
              name="included_miles"
              type="number"
              step="1"
              min="0"
              placeholder={t.includedMilesPlaceholder}
              className={inputCls}
            />
          </div>
        </>
      )}
    </>
  )
}
