'use client'

import { useFormState } from 'react-dom'
import { updateCompanyComplianceAction } from '@/app/actions/compliance'
import type { Dictionary } from '@/lib/i18n/server'

type Labels = Dictionary['admin']['compliance']

const inputCls =
  'w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-xl px-4 py-2.5 text-sl-on-surface ' +
  'placeholder:text-sl-on-surface-muted focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-all'

export interface CompanyComplianceCurrent {
  legal_name: string
  dba: string
  entity_type: string
  state_of_registration: string
  state_registration_number: string
  ein_last4: string
  county: string
  zip_code: string
  operation_areas: string
  operating_license_type: string
  operating_license_number: string
  operating_license_jurisdiction: string
  operating_license_expires_at: string
  operates_interstate: boolean
  usdot_number: string
  mc_number: string
  commercial_insurance_carrier: string
  commercial_insurance_policy_number: string
  commercial_insurance_expires_at: string
  internal_notes: string
}

interface Props {
  current: CompanyComplianceCurrent
  labels: Labels
}

export function CompanyComplianceForm({ current, labels: t }: Props) {
  const [state, formAction] = useFormState(updateCompanyComplianceAction, null)

  return (
    <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6 space-y-6">
      {state && !state.success && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5">
          <p className="text-xs text-red-400">{state.error}</p>
        </div>
      )}
      {state?.success && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-2.5">
          <p className="text-xs text-green-400">{t.saved}</p>
        </div>
      )}

      <form action={formAction} className="space-y-8">
        {/* Legal identity */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.legalIdentityTitle}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-sl-on-surface-muted">{t.legalName}</label>
              <input name="legal_name" type="text" defaultValue={current.legal_name} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-sl-on-surface-muted">{t.dba}</label>
              <input name="dba" type="text" defaultValue={current.dba} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-sl-on-surface-muted">{t.entityType}</label>
              <input name="entity_type" type="text" placeholder="LLC, Corp, Sole Proprietor…" defaultValue={current.entity_type} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-sl-on-surface-muted">{t.stateOfRegistration}</label>
              <input name="state_of_registration" type="text" placeholder="FL" defaultValue={current.state_of_registration} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-sl-on-surface-muted">{t.stateRegistrationNumber}</label>
              <input name="state_registration_number" type="text" defaultValue={current.state_registration_number} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-sl-on-surface-muted">{t.einLast4}</label>
              <input name="ein_last4" type="text" inputMode="numeric" maxLength={4} defaultValue={current.ein_last4} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-sl-on-surface-muted">{t.county}</label>
              <input name="county" type="text" placeholder="Miami-Dade" defaultValue={current.county} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-sl-on-surface-muted">{t.zipCode}</label>
              <input name="zip_code" type="text" defaultValue={current.zip_code} className={inputCls} />
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-1">
              <label className="text-xs text-sl-on-surface-muted">{t.operationAreas}</label>
              <input name="operation_areas" type="text" placeholder={t.operationAreasHint} defaultValue={current.operation_areas} className={inputCls} />
            </div>
          </div>
        </div>

        {/* Operating license */}
        <div className="space-y-3 border-t border-sl-outline-variant pt-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.operatingLicenseTitle}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-sl-on-surface-muted">{t.operatingLicenseType}</label>
              <input name="operating_license_type" type="text" defaultValue={current.operating_license_type} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-sl-on-surface-muted">{t.operatingLicenseNumber}</label>
              <input name="operating_license_number" type="text" defaultValue={current.operating_license_number} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-sl-on-surface-muted">{t.operatingLicenseJurisdiction}</label>
              <input name="operating_license_jurisdiction" type="text" defaultValue={current.operating_license_jurisdiction} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-sl-on-surface-muted">{t.operatingLicenseExpires}</label>
              <input name="operating_license_expires_at" type="date" defaultValue={current.operating_license_expires_at} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <label className="flex items-center gap-2 text-xs text-sl-on-surface-muted pb-2.5">
              <input
                type="checkbox"
                name="operates_interstate"
                value="true"
                defaultChecked={current.operates_interstate}
                className="rounded border-sl-outline-variant text-bronze focus:ring-bronze"
              />
              {t.operatesInterstate}
            </label>
            <div className="space-y-1">
              <label className="text-xs text-sl-on-surface-muted">{t.usdotNumber}</label>
              <input name="usdot_number" type="text" defaultValue={current.usdot_number} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-sl-on-surface-muted">{t.mcNumber}</label>
              <input name="mc_number" type="text" defaultValue={current.mc_number} className={inputCls} />
            </div>
          </div>
        </div>

        {/* Insurance */}
        <div className="space-y-3 border-t border-sl-outline-variant pt-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.insuranceTitle}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-sl-on-surface-muted">{t.insuranceCarrier}</label>
              <input name="commercial_insurance_carrier" type="text" defaultValue={current.commercial_insurance_carrier} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-sl-on-surface-muted">{t.insurancePolicyNumber}</label>
              <input name="commercial_insurance_policy_number" type="text" defaultValue={current.commercial_insurance_policy_number} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-sl-on-surface-muted">{t.insuranceExpires}</label>
              <input name="commercial_insurance_expires_at" type="date" defaultValue={current.commercial_insurance_expires_at} className={inputCls} />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1 border-t border-sl-outline-variant pt-6">
          <label className="text-xs text-sl-on-surface-muted">{t.internalNotes}</label>
          <textarea
            name="internal_notes"
            rows={3}
            placeholder={t.internalNotesPlaceholder}
            defaultValue={current.internal_notes}
            className={inputCls}
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-5 py-2.5 text-sm font-semibold bg-gold text-gray-900 rounded-xl hover:bg-gold/90 disabled:opacity-60 transition-all"
          >
            {t.save}
          </button>
        </div>
      </form>
    </div>
  )
}
