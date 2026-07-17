'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { updateBrandingAction } from '@/app/actions/settings'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type SettingsDict = Dictionary['admin']['settings']

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 disabled:opacity-60 transition-colors"
    >
      {pending ? '…' : label}
    </button>
  )
}

export function BrandingForm({
  t,
  currentLogo,
  currentColor,
}: {
  t: SettingsDict
  currentLogo: string | null
  currentColor: string
}) {
  const [state, formAction] = useFormState(updateBrandingAction, null)
  const [preview, setPreview] = useState<string | null>(null)
  const [color, setColor] = useState(currentColor || '#e9c176')
  const [removing, setRemoving] = useState(false)

  // Lo que se muestra: preview local > (a menos que se esté quitando) logo actual
  const shownLogo = preview ?? (removing ? null : state?.logoUrl ?? currentLogo)

  return (
    <section className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6">
      <h2 className="text-sm font-semibold text-sl-on-surface mb-2">{t.brandingTitle}</h2>
      <p className="text-xs text-sl-on-surface-muted mb-5">{t.brandingDesc}</p>

      {state && !state.success && state.error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-600">{state.error}</p>
        </div>
      )}
      {state?.success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-sm text-green-700">{t.brandingSaved}</p>
        </div>
      )}

      <form action={formAction} className="space-y-5">
        <input type="hidden" name="remove_logo" value={removing ? 'true' : 'false'} />

        <div className="flex items-center gap-5 flex-wrap">
          {/* Preview */}
          <div
            className="w-20 h-20 rounded-xl border border-sl-outline-variant flex items-center justify-center overflow-hidden shrink-0"
            style={{ backgroundColor: color }}
          >
            {shownLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shownLogo} alt="logo" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-white font-bold text-2xl">L</span>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-xs text-sl-on-surface-muted">{t.logoLabel}</label>
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0]
                setRemoving(false)
                setPreview(f ? URL.createObjectURL(f) : null)
              }}
              className="block text-xs text-sl-on-surface file:mr-3 file:rounded-lg file:border-0 file:bg-sl-bg file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-bronze hover:file:bg-sl-bg/70 file:cursor-pointer"
            />
            <p className="text-[11px] text-sl-on-surface-muted">{t.logoHint}</p>
            {(currentLogo || preview) && (
              <button
                type="button"
                onClick={() => { setRemoving(true); setPreview(null) }}
                className="text-[11px] text-red-500 hover:text-red-700"
              >
                {t.removeLogo}
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs text-sl-on-surface-muted mb-1">{t.primaryColorLabel}</label>
          <div className="flex items-center gap-3">
            <input
              name="primary_color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-14 rounded-lg border border-sl-outline-variant bg-sl-bg cursor-pointer"
            />
            <span className="text-xs font-mono text-sl-on-surface-muted">{color}</span>
          </div>
        </div>

        <div className="flex justify-end">
          <SaveButton label={t.saveBranding} />
        </div>
      </form>
    </section>
  )
}
