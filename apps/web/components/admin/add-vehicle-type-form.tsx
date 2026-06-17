'use client'

import { useFormState } from 'react-dom'
import { createVehicleTypeAction } from '@/app/actions/fleet'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type TypeFormDict = Dictionary['admin']['fleet']['typeForm']
type ClassesDict = Dictionary['admin']['fleet']['classes']

const VEHICLE_CLASSES = [
  'sedan', 'suv', 'van', 'limousine', 'sprinter', 'bus', 'exotic',
] as const

const inputCls =
  'w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-xl px-4 py-2.5 text-sl-on-surface ' +
  'placeholder:text-sl-on-surface-muted focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-all'

export function AddVehicleTypeForm({
  labels,
  classes,
}: {
  labels: TypeFormDict
  classes: ClassesDict
}) {
  const [state, action, isPending] = useFormState(createVehicleTypeAction, null)

  return (
    <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-4">
        {labels.title}
      </h2>

      {state && !state.success && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
          <p className="text-sm text-red-400">{state.error}</p>
        </div>
      )}
      {state?.success && (
        <div className="mb-4 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3">
          <p className="text-sm text-green-400">{labels.success}</p>
        </div>
      )}

      <form action={action} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-sl-on-surface-muted">{labels.name} *</label>
          <input name="name" type="text" required placeholder="Executive Black Sedan" className={inputCls} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-sl-on-surface-muted">{labels.class} *</label>
          <select name="class" required className={inputCls}>
            <option value="">{labels.selectClass}</option>
            {VEHICLE_CLASSES.map((c) => (
              <option key={c} value={c}>{classes[c]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-sl-on-surface-muted">{labels.capacity} *</label>
          <input name="capacity" type="number" min="1" max="60" required placeholder="4" className={inputCls} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-sl-on-surface-muted">{labels.amenities}</label>
          <input name="amenities" type="text" placeholder={labels.amenitiesPlaceholder} className={inputCls} />
        </div>
        <div className="space-y-1 sm:col-span-2 lg:col-span-4">
          <label className="text-xs text-sl-on-surface-muted">{labels.image}</label>
          <input
            name="image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="block w-full text-xs text-sl-on-surface-muted file:mr-3 file:rounded-lg file:border-0 file:bg-gold file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-gray-900 hover:file:bg-gold/90 file:cursor-pointer"
          />
          <p className="text-[10px] text-sl-on-surface-muted">{labels.imageHint}</p>
        </div>

        <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2 text-sm font-semibold bg-gold text-gray-900 rounded-xl hover:bg-gold/90 disabled:opacity-60 transition-all"
          >
            {isPending ? labels.adding : labels.addButton}
          </button>
        </div>
      </form>
    </div>
  )
}
