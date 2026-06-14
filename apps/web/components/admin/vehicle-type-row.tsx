'use client'

import { useEffect, useState, useTransition } from 'react'
import { useFormState } from 'react-dom'
import {
  updateVehicleTypeAction,
  deleteVehicleTypeAction,
} from '@/app/actions/fleet'
import { VehicleTypeActiveToggle } from './fleet-controls'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type FleetDict = Dictionary['admin']['fleet']
type ActionsDict = Dictionary['admin']['actions']

const VEHICLE_CLASSES = [
  'sedan', 'suv', 'van', 'limousine', 'sprinter', 'bus', 'exotic',
] as const

interface VehicleType {
  id: string
  name: string
  class: string
  capacity: number
  amenities: string[]
  is_active: boolean
}

const inputCls =
  'text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface ' +
  'placeholder:text-sl-on-surface-muted/50 focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'

const btnLink =
  'text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

export function VehicleTypeRow({
  vt,
  fleet,
  actions,
}: {
  vt: VehicleType
  fleet: FleetDict
  actions: ActionsDict
}) {
  const [editing, setEditing] = useState(false)
  const update = updateVehicleTypeAction.bind(null, vt.id)
  const [state, formAction, isPending] = useFormState(update, null)
  const [isDeleting, startDelete] = useTransition()
  const [delErr, setDelErr] = useState<string | null>(null)

  useEffect(() => {
    if (state?.success) setEditing(false)
  }, [state])

  function handleDelete() {
    if (!confirm(actions.confirmDelete)) return
    setDelErr(null)
    startDelete(async () => {
      const res = await deleteVehicleTypeAction(vt.id)
      if (!res.success) {
        setDelErr(res.error === 'IN_USE' ? actions.inUse : res.error ?? 'Error')
      }
    })
  }

  if (editing) {
    return (
      <tr className="bg-sl-bg/40">
        <td colSpan={5} className="px-5 py-4">
          <form action={formAction} className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted">{fleet.typeForm.name}</label>
              <input name="name" defaultValue={vt.name} required className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted">{fleet.typeForm.class}</label>
              <select name="class" defaultValue={vt.class} required className={inputCls}>
                {VEHICLE_CLASSES.map((c) => (
                  <option key={c} value={c}>{fleet.classes[c]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1 w-24">
              <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted">{fleet.typeForm.capacity}</label>
              <input name="capacity" type="number" min="1" max="60" defaultValue={vt.capacity} required className={`${inputCls} w-full`} />
            </div>
            <div className="space-y-1 flex-1 min-w-[180px]">
              <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted">{fleet.typeForm.amenities}</label>
              <input name="amenities" defaultValue={vt.amenities.join(', ')} placeholder={fleet.typeForm.amenitiesPlaceholder} className={`${inputCls} w-full`} />
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
          {state && !state.success && (
            <p className="mt-2 text-xs text-red-500">{state.error}</p>
          )}
        </td>
      </tr>
    )
  }

  return (
    <tr className="hover:bg-sl-bg/40 transition-colors">
      <td className="px-5 py-4">
        <p className="font-medium text-sl-on-surface">{vt.name}</p>
      </td>
      <td className="px-5 py-4">
        <span className="text-xs text-sl-on-surface-muted">
          {fleet.classes[vt.class as keyof typeof fleet.classes] ?? vt.class}
        </span>
      </td>
      <td className="px-5 py-4">
        <span className="text-xs text-sl-on-surface-muted">{vt.capacity} pax</span>
      </td>
      <td className="px-5 py-4">
        <span className="text-xs text-sl-on-surface-muted">
          {vt.amenities.length > 0 ? vt.amenities.join(', ') : '—'}
        </span>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <VehicleTypeActiveToggle typeId={vt.id} isActive={vt.is_active} labels={fleet.activeToggle} />
          <button onClick={() => setEditing(true)} className={`${btnLink} text-bronze hover:text-bronze/80`}>
            {actions.edit}
          </button>
          <button onClick={handleDelete} disabled={isDeleting} className={`${btnLink} text-red-500 hover:text-red-700`}>
            {isDeleting ? actions.deleting : actions.delete}
          </button>
        </div>
        {delErr && <p className="mt-1 text-xs text-red-500">{delErr}</p>}
      </td>
    </tr>
  )
}
