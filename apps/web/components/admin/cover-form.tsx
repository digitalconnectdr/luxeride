'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { updateSiteAction } from '@/app/actions/microsite'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type SettingsDict = Dictionary['admin']['settings']

const inputCls =
  'w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 ' +
  'text-sl-on-surface placeholder:text-sl-on-surface-muted/50 ' +
  'focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'

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

export function CoverForm({
  t,
  tagline,
  about,
  heroImage,
  whatsapp,
  placeId,
}: {
  t: SettingsDict
  tagline: string | null
  about: string | null
  heroImage: string | null
  whatsapp: string | null
  placeId: string | null
}) {
  const [state, formAction] = useFormState(updateSiteAction, null)
  const [preview, setPreview] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  const shownHero = preview ?? (removing ? null : heroImage)

  return (
    <section className="bg-sl-surface border border-sl-outline-variant rounded-xl p-6">
      <h2 className="text-sm font-semibold text-sl-on-surface mb-1">{t.coverTitle}</h2>
      <p className="text-xs text-sl-on-surface-muted mb-5">{t.coverDesc}</p>

      {state && !state.success && state.error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-600">{state.error}</p>
        </div>
      )}
      {state?.success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-sm text-green-700">{t.coverSaved}</p>
        </div>
      )}

      <form action={formAction} className="space-y-5">
        <input type="hidden" name="remove_hero" value={removing ? 'true' : 'false'} />

        <div>
          <label className="block text-xs text-sl-on-surface-muted mb-1">{t.taglineLabel}</label>
          <input name="tagline" defaultValue={tagline ?? ''} placeholder={t.taglinePlaceholder} maxLength={140} className={inputCls} />
        </div>

        <div>
          <label className="block text-xs text-sl-on-surface-muted mb-1">{t.heroImageLabel}</label>
          {shownHero && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shownHero} alt="hero" className="w-full h-32 object-cover rounded-lg border border-sl-outline-variant mb-2" />
          )}
          <input
            type="file"
            name="hero_image"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0]
              setRemoving(false)
              setPreview(f ? URL.createObjectURL(f) : null)
            }}
            className="block text-xs text-sl-on-surface file:mr-3 file:rounded-lg file:border-0 file:bg-sl-bg file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-bronze hover:file:bg-sl-bg/70 file:cursor-pointer"
          />
          <p className="text-[11px] text-sl-on-surface-muted mt-1">{t.heroImageHint}</p>
          {(heroImage || preview) && (
            <button
              type="button"
              onClick={() => { setRemoving(true); setPreview(null) }}
              className="text-[11px] text-red-500 hover:text-red-700 mt-1"
            >
              {t.removeHero}
            </button>
          )}
        </div>

        <div>
          <label className="block text-xs text-sl-on-surface-muted mb-1">{t.aboutLabel}</label>
          <textarea name="about" defaultValue={about ?? ''} placeholder={t.aboutPlaceholder} rows={4} maxLength={2000} className={`${inputCls} resize-y`} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-sl-outline-variant/50">
          <div>
            <label className="block text-xs text-sl-on-surface-muted mb-1">{t.whatsappLabel}</label>
            <input name="whatsapp" defaultValue={whatsapp ?? ''} placeholder="18091234567" className={inputCls} />
            <p className="text-[11px] text-sl-on-surface-muted mt-1">{t.whatsappHint}</p>
          </div>
          <div>
            <label className="block text-xs text-sl-on-surface-muted mb-1">{t.placeIdLabel}</label>
            <input name="google_place_id" defaultValue={placeId ?? ''} placeholder="ChIJ…" className={inputCls} />
            <p className="text-[11px] text-sl-on-surface-muted mt-1">{t.placeIdHint}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <SaveButton label={t.saveCover} />
        </div>
      </form>
    </section>
  )
}
