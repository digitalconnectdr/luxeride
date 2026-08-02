'use client'

import { useFormState } from 'react-dom'
import { updateDriverLicense } from '@/app/actions/fleet'
import type { Dictionary } from '@/lib/i18n/server'

type Labels = Pick<
  Dictionary['admin']['driverDetail'],
  'licenseFormTitle' | 'licenseUpdated' | 'licenseNumber' | 'licenseStateIssuer' | 'licenseExpiryDate' | 'update'
  | 'genderLabel' | 'genderUnspecified' | 'genderFemale' | 'genderMale'
>

const inputCls =
  'w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-xl px-4 py-2.5 text-sl-on-surface ' +
  'placeholder:text-sl-on-surface-muted focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-all'

interface Props {
  driverId: string
  current: {
    license_number: string
    license_expiry: string   // ISO date string or ''
    license_state:  string
    gender: string | null
  }
  labels: Labels
}

export function UpdateDriverLicenseForm({ driverId, current, labels: t }: Props) {
  // useFormState retorna [state, formAction] en React 18 (2 valores, no 3)
  const [state, formAction] = useFormState(
    updateDriverLicense.bind(null, driverId),
    null
  )

  return (
    <div className="border-t border-sl-outline-variant pt-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-3">
        {t.licenseFormTitle}
      </p>

      {state && !state.success && (
        <div className="mb-3 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5">
          <p className="text-xs text-red-400">{state.error}</p>
        </div>
      )}
      {state?.success && (
        <div className="mb-3 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-2.5">
          <p className="text-xs text-green-400">{t.licenseUpdated}</p>
        </div>
      )}

      <form action={formAction} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-sl-on-surface-muted">{t.licenseNumber}</label>
          <input
            name="license_number"
            type="text"
            defaultValue={current.license_number}
            placeholder="A1234567"
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-sl-on-surface-muted">{t.licenseStateIssuer}</label>
          <input
            name="license_state"
            type="text"
            defaultValue={current.license_state}
            placeholder="CDMX"
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-sl-on-surface-muted">{t.licenseExpiryDate}</label>
          <input
            name="license_expiry"
            type="date"
            defaultValue={current.license_expiry ? current.license_expiry.split('T')[0] : ''}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-sl-on-surface-muted">{t.genderLabel}</label>
          <select name="gender" defaultValue={current.gender ?? ''} className={inputCls}>
            <option value="">{t.genderUnspecified}</option>
            <option value="female">{t.genderFemale}</option>
            <option value="male">{t.genderMale}</option>
          </select>
        </div>

        <div className="sm:col-span-3 flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold bg-gold text-gray-900 rounded-xl hover:bg-gold/90 disabled:opacity-60 transition-all"
          >
            {t.update}
          </button>
        </div>
      </form>
    </div>
  )
}
