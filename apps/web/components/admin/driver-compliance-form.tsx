'use client'

import { useFormState } from 'react-dom'
import { updateDriverComplianceAction } from '@/app/actions/compliance'
import type { Dictionary } from '@/lib/i18n/server'

type Labels = Pick<
  Dictionary['admin']['driverDetail'],
  | 'chauffeurPermitType' | 'chauffeurPermitNumber'
  | 'chauffeurPermitJurisdiction' | 'chauffeurPermitExpires' | 'licenseClass'
  | 'complianceSave' | 'complianceSaved'
>

const inputCls =
  'w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-xl px-4 py-2.5 text-sl-on-surface ' +
  'placeholder:text-sl-on-surface-muted focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-all'

interface Props {
  driverId: string
  current: {
    chauffeur_permit_type: string
    chauffeur_permit_number: string
    chauffeur_permit_jurisdiction: string
    chauffeur_permit_expires_at: string
    license_class: string
  }
  labels: Labels
}

export function DriverComplianceForm({ driverId, current, labels: t }: Props) {
  const [state, formAction] = useFormState(updateDriverComplianceAction.bind(null, driverId), null)

  return (
    <div className="border-t border-sl-outline-variant pt-4">
      {state && !state.success && (
        <div className="mb-3 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5">
          <p className="text-xs text-red-400">{state.error}</p>
        </div>
      )}
      {state?.success && (
        <div className="mb-3 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-2.5">
          <p className="text-xs text-green-400">{t.complianceSaved}</p>
        </div>
      )}

      <form action={formAction} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-sl-on-surface-muted">{t.chauffeurPermitType}</label>
          <input name="chauffeur_permit_type" type="text" defaultValue={current.chauffeur_permit_type} className={inputCls} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-sl-on-surface-muted">{t.chauffeurPermitNumber}</label>
          <input name="chauffeur_permit_number" type="text" defaultValue={current.chauffeur_permit_number} className={inputCls} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-sl-on-surface-muted">{t.chauffeurPermitJurisdiction}</label>
          <input name="chauffeur_permit_jurisdiction" type="text" defaultValue={current.chauffeur_permit_jurisdiction} className={inputCls} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-sl-on-surface-muted">{t.chauffeurPermitExpires}</label>
          <input name="chauffeur_permit_expires_at" type="date" defaultValue={current.chauffeur_permit_expires_at} className={inputCls} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-sl-on-surface-muted">{t.licenseClass}</label>
          <input name="license_class" type="text" defaultValue={current.license_class} className={inputCls} />
        </div>

        <div className="sm:col-span-2 flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold bg-gold text-gray-900 rounded-xl hover:bg-gold/90 disabled:opacity-60 transition-all"
          >
            {t.complianceSave}
          </button>
        </div>
      </form>
    </div>
  )
}
