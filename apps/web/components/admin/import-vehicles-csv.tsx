'use client'
// ── Importación masiva de vehículos por CSV (Sección H, item 1) ──────────────

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { importVehiclesCsvAction } from '@/app/actions/fleet'

export interface ImportVehiclesCsvLabels {
  trigger: string
  title: string
  desc: string
  downloadTemplate: string
  fileLabel: string
  submit: string
  submitting: string
  cancel: string
  imported: string
  skippedRows: string
  rowError: string
}

const TEMPLATE_HEADER = 'make,model,year,color,plate_number,vin,mileage,vehicle_type'
const TEMPLATE_EXAMPLE = 'Mercedes-Benz,S-Class,2023,Black,ABC-123,WDDUG8DB0KA123456,15000,Luxury Sedan'

function SubmitButton({ labels }: { labels: ImportVehiclesCsvLabels }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 text-sm font-semibold bg-gold text-gray-900 rounded-xl hover:bg-gold/90 disabled:opacity-50 transition-colors"
    >
      {pending ? labels.submitting : labels.submit}
    </button>
  )
}

export function ImportVehiclesCsv({ labels: t }: { labels: ImportVehiclesCsvLabels }) {
  const [open, setOpen] = useState(false)
  const [state, action] = useFormState(importVehiclesCsvAction, null)

  function downloadTemplate() {
    const blob = new Blob([`${TEMPLATE_HEADER}\n${TEMPLATE_EXAMPLE}\n`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'luxeride-vehiculos-plantilla.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-semibold border border-sl-outline-variant text-sl-on-surface rounded-xl hover:border-bronze transition-colors"
      >
        {t.trigger}
      </button>
    )
  }

  return (
    <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-sl-on-surface">{t.title}</p>
        <p className="text-xs text-sl-on-surface-muted mt-1">{t.desc}</p>
      </div>

      <button
        type="button"
        onClick={downloadTemplate}
        className="text-xs text-bronze hover:text-bronze/80 underline underline-offset-2 transition-colors"
      >
        {t.downloadTemplate}
      </button>

      <form action={action} className="space-y-3">
        <div>
          <label className="block text-xs text-sl-on-surface-muted mb-1.5">{t.fileLabel}</label>
          <input
            type="file"
            name="csv_file"
            accept=".csv,text/csv"
            required
            className="w-full text-sm text-sl-on-surface file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-sl-bg file:text-sl-on-surface file:text-xs file:font-medium hover:file:bg-sl-outline-variant/30 transition-colors"
          />
        </div>

        {state && !state.success && state.error && (
          <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}
        {state?.success && (
          <div className="text-sm text-green-600 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 space-y-1">
            <p>{t.imported.replace('{n}', String(state.imported))}</p>
            {state.skipped.length > 0 && (
              <div className="pt-1 border-t border-green-500/20">
                <p className="text-xs font-medium text-amber-600">
                  {t.skippedRows.replace('{n}', String(state.skipped.length))}
                </p>
                <ul className="text-xs text-sl-on-surface-muted mt-1 space-y-0.5">
                  {state.skipped.slice(0, 10).map((s) => (
                    <li key={s.row}>{t.rowError.replace('{row}', String(s.row)).replace('{reason}', s.reason)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 text-sm font-medium border border-sl-outline-variant rounded-xl text-sl-on-surface-muted hover:text-sl-on-surface transition-colors"
          >
            {t.cancel}
          </button>
          <SubmitButton labels={t} />
        </div>
      </form>
    </div>
  )
}
