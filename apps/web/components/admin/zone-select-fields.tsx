'use client'
// ── Selects de zona origen/destino — solo se muestran cuando el modelo de
// precio es "Por zona" (zone_based). Compartido entre el form de creación
// (pricing-model-field.tsx) y el de edición (pricing-rule-row.tsx).

import { InfoTip } from '@/components/ui/info-tip'

export interface ZoneSelectLabels {
  originZone: string
  destinationZone: string
  selectZone: string
  helpOriginZone: string
  helpDestinationZone: string
}

export function ZoneSelectFields({
  zones,
  defaultOriginZoneId,
  defaultDestinationZoneId,
  labels,
  inputCls,
}: {
  zones: { id: string; name: string }[]
  defaultOriginZoneId?: string | null
  defaultDestinationZoneId?: string | null
  labels: ZoneSelectLabels
  inputCls: string
}) {
  return (
    <>
      <div>
        <label className="block text-xs text-sl-on-surface-muted mb-1">
          {labels.originZone}
          <InfoTip text={labels.helpOriginZone} />
        </label>
        <select name="origin_zone_id" defaultValue={defaultOriginZoneId ?? ''} className={inputCls}>
          <option value="">{labels.selectZone}</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>{z.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-sl-on-surface-muted mb-1">
          {labels.destinationZone}
          <InfoTip text={labels.helpDestinationZone} />
        </label>
        <select name="destination_zone_id" defaultValue={defaultDestinationZoneId ?? ''} className={inputCls}>
          <option value="">{labels.selectZone}</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>{z.name}</option>
          ))}
        </select>
      </div>
    </>
  )
}
