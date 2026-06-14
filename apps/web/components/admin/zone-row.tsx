'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { updateZoneAction } from '@/app/actions/services'
import { ZoneActiveToggle, ZoneDeleteButton } from './zone-controls'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type ZonesDict = Dictionary['admin']['zones']
type ActionsDict = Dictionary['admin']['actions']

const ZONE_TYPES = ['standard', 'airport', 'premium', 'restricted'] as const
type ZoneType = (typeof ZONE_TYPES)[number]

const zoneBadge: Record<ZoneType, string> = {
  standard:   'bg-blue-50 text-blue-700 border-blue-200',
  airport:    'bg-purple-50 text-purple-700 border-purple-200',
  premium:    'bg-amber-50 text-amber-700 border-amber-200',
  restricted: 'bg-red-50 text-red-700 border-red-200',
}

interface Zone {
  id: string
  name: string
  type: string
  color: string | null
  radius_miles: number | null
  is_active: boolean
}

const inputCls =
  'text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface ' +
  'placeholder:text-sl-on-surface-muted/50 focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'

export function ZoneRow({
  zone,
  t,
  actions,
  isAdmin,
}: {
  zone: Zone
  t: ZonesDict
  actions: ActionsDict
  isAdmin: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErr(null)
    startTransition(async () => {
      const res = await updateZoneAction(zone.id, fd)
      if (res.success) setEditing(false)
      else setErr(res.error ?? 'Error')
    })
  }

  if (editing) {
    return (
      <tr className="bg-sl-bg/40">
        <td colSpan={5} className="px-5 py-4">
          <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1 flex-1 min-w-[160px]">
              <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted">{t.nameLabel}</label>
              <input name="name" defaultValue={zone.name} required className={`${inputCls} w-full`} />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted">{t.typeLabel}</label>
              <select name="type" defaultValue={zone.type} className={inputCls}>
                {ZONE_TYPES.map((zt) => (
                  <option key={zt} value={zt}>{t.types[zt]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1 w-28">
              <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted">{t.radiusLabel}</label>
              <input name="radius_miles" type="number" min="0" step="0.1" defaultValue={zone.radius_miles ?? ''} placeholder={t.radiusPlaceholder} className={`${inputCls} w-full`} />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted">{t.colorLabel}</label>
              <input name="color" type="color" defaultValue={zone.color ?? '#e9c176'} className="h-9 w-14 rounded-lg border border-sl-outline-variant bg-sl-bg cursor-pointer" />
            </div>
            <div className="flex items-center gap-3 pb-1">
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
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: zone.color ?? '#e9c176' }} />
          <span className="font-medium text-sl-on-surface">{zone.name}</span>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${zoneBadge[zone.type as ZoneType] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
          {t.types[zone.type as ZoneType] ?? zone.type}
        </span>
      </td>
      <td className="px-5 py-3.5 text-sl-on-surface-muted text-xs">
        {zone.radius_miles ? `${zone.radius_miles} mi` : '—'}
      </td>
      <td className="px-5 py-3.5">
        {isAdmin ? (
          <ZoneActiveToggle zoneId={zone.id} isActive={zone.is_active} />
        ) : (
          <span className={`text-xs font-medium ${zone.is_active ? 'text-green-700' : 'text-gray-400'}`}>
            {zone.is_active ? t.active : t.inactive}
          </span>
        )}
      </td>
      {isAdmin && (
        <td className="px-5 py-3.5 text-right">
          <div className="flex items-center justify-end gap-3">
            <button onClick={() => setEditing(true)} className="text-xs font-medium text-bronze hover:text-bronze/80 transition-colors">
              {actions.edit}
            </button>
            <ZoneDeleteButton zoneId={zone.id} />
          </div>
        </td>
      )}
    </tr>
  )
}
