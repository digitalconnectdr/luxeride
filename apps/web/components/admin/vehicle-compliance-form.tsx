'use client'

import { useFormState } from 'react-dom'
import { updateVehicleComplianceAction } from '@/app/actions/compliance'
import type { Dictionary } from '@/lib/i18n/server'

type Labels = Pick<
  Dictionary['admin']['vehicleDetail'],
  | 'forhirePermitNumber' | 'forhirePermitJurisdiction' | 'forhirePermitExpires'
  | 'inspectionDate' | 'inspectionStatus' | 'inspectionUnknown' | 'inspectionPassed' | 'inspectionFailed'
  | 'insuranceCarrier' | 'insurancePolicyNumber' | 'complianceSave' | 'complianceSaved'
>

const inputCls =
  'w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-xl px-4 py-2.5 text-sl-on-surface ' +
  'placeholder:text-sl-on-surface-muted focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-all'

interface Props {
  vehicleId: string
  current: {
    forhire_permit_number: string
    forhire_permit_jurisdiction: string
    forhire_permit_expires_at: string
    inspection_date: string
    inspection_status: string
    insurance_carrier: string
    insurance_policy_number: string
  }
  labels: Labels
}

export function VehicleComplianceForm({ vehicleId, current, labels: t }: Props) {
  const [state, formAction] = useFormState(updateVehicleComplianceAction.bind(null, vehicleId), null)

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
          <label className="text-xs text-sl-on-surface-muted">{t.forhirePermitNumber}</label>
          <input name="forhire_permit_number" type="text" defaultValue={current.forhire_permit_number} className={inputCls} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-sl-on-surface-muted">{t.forhirePermitJurisdiction}</label>
          <input name="forhire_permit_jurisdiction" type="text" defaultValue={current.forhire_permit_jurisdiction} className={inputCls} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-sl-on-surface-muted">{t.forhirePermitExpires}</label>
          <input name="forhire_permit_expires_at" type="date" defaultValue={current.forhire_permit_expires_at} className={inputCls} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-sl-on-surface-muted">{t.inspectionDate}</label>
          <input name="inspection_date" type="date" defaultValue={current.inspection_date} className={inputCls} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-sl-on-surface-muted">{t.inspectionStatus}</label>
          <select name="inspection_status" defaultValue={current.inspection_status} className={inputCls}>
            <option value="">{t.inspectionUnknown}</option>
            <option value="passed">{t.inspectionPassed}</option>
            <option value="failed">{t.inspectionFailed}</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-sl-on-surface-muted">{t.insuranceCarrier}</label>
          <input name="insurance_carrier" type="text" defaultValue={current.insurance_carrier} className={inputCls} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-sl-on-surface-muted">{t.insurancePolicyNumber}</label>
          <input name="insurance_policy_number" type="text" defaultValue={current.insurance_policy_number} className={inputCls} />
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
