'use client'

import { useFormState } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { createVehicleAction } from '@/app/actions/fleet'
import { ActionErrorBanner } from '@/components/admin/action-error-banner'
import type { Dictionary } from '@/lib/i18n/server'

type Labels = Dictionary['admin']['vehicleNew']

const inputCls =
  'w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-xl px-4 py-2.5 text-sl-on-surface ' +
  'placeholder:text-sl-on-surface-muted focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-all'

interface Props {
  types: Array<{ id: string; name: string }>
  labels: Labels
}

export function NewVehicleForm({ types, labels: t }: Props) {
  const [state, action, isPending] = useFormState(createVehicleAction, null)
  const router = useRouter()

  useEffect(() => {
    if (state?.success && state.id) {
      router.push(`/admin/fleet/${state.id}`)
    }
  }, [state, router])

  return (
    <form action={action} className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6 space-y-6">

      {state && !state.success && state.error && <ActionErrorBanner error={state.error} />}

      {/* Identification */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
          {t.identification}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-sl-on-surface-muted">{t.make} *</label>
            <input name="make" type="text" required placeholder="Mercedes-Benz" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-sl-on-surface-muted">{t.model} *</label>
            <input name="model" type="text" required placeholder="S-Class" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-sl-on-surface-muted">{t.year} *</label>
            <input name="year" type="number" required min="1990" max="2030" placeholder="2024" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-sl-on-surface-muted">{t.color}</label>
            <input name="color" type="text" placeholder="Negro Obsidiana" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-sl-on-surface-muted">{t.plate} *</label>
            <input name="plate_number" type="text" required placeholder="ABC-1234" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-sl-on-surface-muted">{t.vin}</label>
            <input name="vin" type="text" placeholder="1HGBH41JXMN109186" className={inputCls} />
          </div>
        </div>
      </section>

      <hr className="border-sl-outline-variant" />

      {/* Classification */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
          {t.classification}
        </h2>
        <div className="space-y-1.5 max-w-xs">
          <label className="text-xs text-sl-on-surface-muted">{t.vehicleType}</label>
          <select name="vehicle_type_id" className={inputCls}>
            <option value="">{t.noType}</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </section>

      <hr className="border-sl-outline-variant" />

      {/* Maintenance & Insurance */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
          {t.maintenanceInsurance}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-sl-on-surface-muted">{t.mileage}</label>
            <input name="mileage" type="number" min="0" placeholder="0" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-sl-on-surface-muted">{t.nextMaintenance}</label>
            <input name="next_maintenance_at" type="date" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-sl-on-surface-muted">{t.insuranceExpires}</label>
            <input name="insurance_expires_at" type="date" className={inputCls} />
          </div>
        </div>
      </section>

      <hr className="border-sl-outline-variant" />

      {/* Notes */}
      <section className="space-y-1.5">
        <label className="text-xs text-sl-on-surface-muted">{t.internalNotes}</label>
        <textarea
          name="notes"
          rows={3}
          placeholder={t.notesPlaceholder}
          className={inputCls + ' resize-none'}
        />
      </section>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <a
          href="/admin/fleet"
          className="px-4 py-2 text-sm text-sl-on-surface-muted hover:text-sl-on-surface transition-colors"
        >
          {t.cancel}
        </a>
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2 text-sm font-semibold bg-gold text-gray-900 rounded-xl hover:bg-gold/90 disabled:opacity-60 transition-all"
        >
          {isPending ? t.saving : t.save}
        </button>
      </div>
    </form>
  )
}
