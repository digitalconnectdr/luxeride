'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { updateSiteAction } from '@/app/actions/microsite'
import { InfoTip } from '@/components/ui/info-tip'
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/config'
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

const TEMPLATES = [
  { id: 'noir', swatch: 'linear-gradient(135deg,#08080a,#1c1c20)', line: '#c9a24b' },
  { id: 'ivory', swatch: 'linear-gradient(135deg,#f5f1e9,#e4ddcf)', line: '#1d1b18' },
  { id: 'bold', swatch: 'linear-gradient(135deg,#0a0a0a,#0a0a0a 50%,#c9a24b 50%,#c9a24b)', line: '#ffffff' },
  { id: 'corporate', swatch: 'linear-gradient(135deg,#ffffff,#f3f4f6)', line: '#161a1f' },
] as const

export function CoverForm({
  t,
  tagline,
  about,
  i18nContent,
  heroImage,
  whatsapp,
  placeId,
  template,
}: {
  t: SettingsDict
  tagline: string | null
  about: string | null
  i18nContent: Partial<Record<Locale, { tagline?: string | null; about?: string | null }>> | null
  heroImage: string | null
  whatsapp: string | null
  placeId: string | null
  template: string
}) {
  const [state, formAction] = useFormState(updateSiteAction, null)
  const [preview, setPreview] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const [tpl, setTpl] = useState(TEMPLATES.some((t) => t.id === template) ? template : 'noir')
  const [activeLocale, setActiveLocale] = useState<Locale>('es')
  // ES vive históricamente en las columnas tagline/about (no en settings.site.i18n)
  // para no perder lo ya guardado; EN/PT son overrides opcionales nuevos.
  const initialText = (loc: Locale, field: 'tagline' | 'about') =>
    loc === 'es' ? ((field === 'tagline' ? tagline : about) ?? '') : (i18nContent?.[loc]?.[field] ?? '')

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

        {/* Selector de plantilla del micrositio */}
        <div>
          <label className="block text-xs text-sl-on-surface-muted mb-2">{t.templateLabel}</label>
          <div className="grid grid-cols-2 gap-3">
            {TEMPLATES.map((opt) => {
              const active = tpl === opt.id
              const LABELS: Record<string, string> = { noir: t.templateNoir, ivory: t.templateIvory, bold: t.templateBold, corporate: t.templateCorporate }
              const DESCS: Record<string, string> = { noir: t.templateNoirDesc, ivory: t.templateIvoryDesc, bold: t.templateBoldDesc, corporate: t.templateCorporateDesc }
              const label = LABELS[opt.id]
              const desc = DESCS[opt.id]
              return (
                <label key={opt.id} className={`cursor-pointer rounded-xl border-2 p-3 transition-colors ${active ? 'border-bronze' : 'border-sl-outline-variant hover:border-bronze/50'}`}>
                  <input type="radio" name="template" value={opt.id} checked={active} onChange={() => setTpl(opt.id)} className="sr-only" />
                  <div className="relative h-16 rounded-lg mb-2 overflow-hidden ring-1 ring-black/5" style={{ background: opt.swatch }}>
                    <span className="absolute left-2 top-2 h-px w-7" style={{ background: opt.line }} />
                    <span className="absolute left-2 bottom-2 h-1.5 w-10 rounded-full opacity-70" style={{ background: opt.line }} />
                  </div>
                  <p className="text-xs font-medium text-sl-on-surface">{label}</p>
                  <p className="text-[11px] text-sl-on-surface-muted leading-snug mt-0.5">{desc}</p>
                </label>
              )
            })}
          </div>
        </div>

        {/* Slogan + about, por idioma */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs text-sl-on-surface-muted">{t.taglineLabel} / {t.aboutLabel}</label>
            <div className="flex gap-1 rounded-lg bg-sl-bg p-0.5">
              {LOCALES.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setActiveLocale(loc)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${activeLocale === loc ? 'bg-bronze text-white' : 'text-sl-on-surface-muted hover:text-sl-on-surface'}`}
                >
                  {loc.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-sl-on-surface-muted mb-2">{t.translationsHint}</p>
          {LOCALES.map((loc) => (
            <div key={loc} className={activeLocale === loc ? 'space-y-2' : 'hidden'}>
              <input
                name={`tagline_${loc}`}
                defaultValue={initialText(loc, 'tagline')}
                placeholder={`${t.taglinePlaceholder} (${LOCALE_LABELS[loc]})`}
                maxLength={140}
                className={inputCls}
              />
              <textarea
                name={`about_${loc}`}
                defaultValue={initialText(loc, 'about')}
                placeholder={t.aboutPlaceholder}
                rows={4}
                maxLength={2000}
                className={`${inputCls} resize-y`}
              />
            </div>
          ))}
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

        <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-sl-outline-variant/50">
          <div>
            <label className="block text-xs text-sl-on-surface-muted mb-1">{t.whatsappLabel}</label>
            <input name="whatsapp" defaultValue={whatsapp ?? ''} placeholder="18091234567" className={inputCls} />
            <p className="text-[11px] text-sl-on-surface-muted mt-1">{t.whatsappHint}</p>
          </div>
          <div>
            <label className="block text-xs text-sl-on-surface-muted mb-1">{t.placeIdLabel}<InfoTip text={t.placeIdInfo} /></label>
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
