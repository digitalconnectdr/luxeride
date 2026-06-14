'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { updateAirportFeeAction } from '@/app/actions/services'
import { AirportActiveToggle, AirportRemoveButton } from './airport-controls'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type AirportsDict = Dictionary['admin']['airports']
type ActionsDict = Dictionary['admin']['actions']

interface CompanyAirport {
  id: string
  pickup_fee: number
  dropoff_fee: number
  is_active: boolean
}

interface AirportInfo {
  iata_code: string
  name: string
  city: string | null
  country: string | null
}

const inputCls =
  'w-24 text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface ' +
  'focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'

export function AirportRow({
  ca,
  airport,
  t,
  actions,
  isAdmin,
}: {
  ca: CompanyAirport
  airport: AirportInfo | null
  t: AirportsDict
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
      const res = await updateAirportFeeAction(ca.id, fd)
      if (res.success) setEditing(false)
      else setErr(res.error ?? 'Error')
    })
  }

  if (editing) {
    return (
      <tr className="bg-sl-bg/40">
        <td colSpan={5} className="px-5 py-4">
          <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
            <div>
              <span className="font-semibold text-sl-on-surface text-xs bg-sl-outline-variant/30 px-1.5 py-0.5 rounded mr-2">
                {airport?.iata_code}
              </span>
              <span className="text-sm text-sl-on-surface">{airport?.name}</span>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted">{t.thPickup}</label>
              <input name="pickup_fee" type="number" step="0.01" min="0" defaultValue={Number(ca.pickup_fee)} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted">{t.thDropoff}</label>
              <input name="dropoff_fee" type="number" step="0.01" min="0" defaultValue={Number(ca.dropoff_fee)} className={inputCls} />
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
        <div>
          <span className="font-semibold text-sl-on-surface text-xs bg-sl-outline-variant/30 px-1.5 py-0.5 rounded mr-2">
            {airport?.iata_code}
          </span>
          <span className="text-sl-on-surface">{airport?.name}</span>
        </div>
        <p className="text-xs text-sl-on-surface-muted mt-0.5 pl-9">
          {airport?.city}, {airport?.country}
        </p>
      </td>
      <td className="px-5 py-3.5 text-right">
        <span className="font-medium text-sl-on-surface">${Number(ca.pickup_fee).toFixed(2)}</span>
      </td>
      <td className="px-5 py-3.5 text-right">
        <span className="font-medium text-sl-on-surface">${Number(ca.dropoff_fee).toFixed(2)}</span>
      </td>
      <td className="px-5 py-3.5">
        {isAdmin ? (
          <AirportActiveToggle id={ca.id} isActive={ca.is_active} />
        ) : (
          <span className={`text-xs font-medium ${ca.is_active ? 'text-green-700' : 'text-gray-400'}`}>
            {ca.is_active ? t.active : t.inactive}
          </span>
        )}
      </td>
      {isAdmin && (
        <td className="px-5 py-3.5 text-right">
          <div className="flex items-center justify-end gap-3">
            <button onClick={() => setEditing(true)} className="text-xs font-medium text-bronze hover:text-bronze/80 transition-colors">
              {actions.edit}
            </button>
            <AirportRemoveButton id={ca.id} />
          </div>
        </td>
      )}
    </tr>
  )
}
