'use client'
// ── Formulario "Agregar zona" — se limpia solo al guardar ──────────────────────
// Antes era un <form action={...}> server-action plano: al guardar, Next.js
// re-renderiza vía RSC pero NUNCA recarga la página, así que los inputs
// (sobre todo el estado de React dentro de ZoneGeoFields — radio, códigos
// postales, centro del mapa) quedaban con los valores viejos y había que
// borrarlos a mano. Ahora se maneja el submit acá: al tener éxito, se resetea
// el form nativo Y se fuerza a ZoneGeoFields a re-montar con estado limpio.

import { useState, useRef, useTransition, type FormEvent } from 'react'
import { createZoneAction } from '@/app/actions/services'
import { ZoneGeoFields } from './zone-geo-fields'
import { InfoTip } from '@/components/ui/info-tip'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type ZonesDict = Dictionary['admin']['zones']

const ZONE_TYPES = ['standard', 'airport', 'premium', 'restricted'] as const

export function AddZoneForm({ t }: { t: ZonesDict }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [resetKey, setResetKey] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErr(null)
    startTransition(async () => {
      const res = await createZoneAction(fd)
      if (res.success) {
        formRef.current?.reset()
        setResetKey((k) => k + 1) // re-monta ZoneGeoFields con estado limpio
      } else {
        setErr(res.error ?? 'Error')
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
      <div className="flex-1 min-w-[180px]">
        <label className="block text-xs text-sl-on-surface-muted mb-1">
          {t.nameLabel}
          <InfoTip text={t.help.name} />
        </label>
        <input
          name="name"
          required
          placeholder={t.namePlaceholder}
          className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface placeholder:text-sl-on-surface-muted/50 focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
        />
      </div>
      <div>
        <label className="block text-xs text-sl-on-surface-muted mb-1">
          {t.typeLabel}
          <InfoTip text={t.help.type} />
        </label>
        <select
          name="type"
          defaultValue="standard"
          className="text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
        >
          {ZONE_TYPES.map((zt) => (
            <option key={zt} value={zt}>{t.types[zt]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-sl-on-surface-muted mb-1">{t.colorLabel}</label>
        <input
          name="color"
          type="color"
          defaultValue="#e9c176"
          className="h-9 w-14 rounded-lg border border-sl-outline-variant bg-sl-bg cursor-pointer"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 disabled:opacity-60 transition-colors"
      >
        {isPending ? t.addButtonSaving : t.addButton}
      </button>
      <ZoneGeoFields
        key={resetKey}
        labels={{
          radiusLabel: t.radiusLabel,
          radiusPlaceholder: t.radiusPlaceholder,
          radiusHelp: t.help.radius,
          postalCodesLabel: t.postalCodesLabel,
          postalCodesPlaceholder: t.postalCodesPlaceholder,
          postalCodesHelp: t.help.postalCodes,
          mapHint: t.mapHint,
          clearCenter: t.clearCenter,
        }}
      />
      {err && <p className="text-xs text-red-500 w-full">{err}</p>}
    </form>
  )
}
