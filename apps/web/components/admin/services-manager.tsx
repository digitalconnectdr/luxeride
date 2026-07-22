'use client'

import { useRef, useState, useTransition, type FormEvent } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import {
  createServiceAction,
  updateServiceAction,
  toggleServiceActiveAction,
  deleteServiceAction,
} from '@/app/actions/microsite'
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type SettingsDict = Dictionary['admin']['settings']
type ActionsDict = Dictionary['admin']['actions']

export interface Service {
  id: string
  title: string
  description: string | null
  icon: string | null
  is_active: boolean
  i18n?: Partial<Record<Locale, { title?: string | null; description?: string | null }>> | null
}

// Íconos seleccionables (transporte premium) — evita que la empresa escriba emojis
const SERVICE_ICONS = [
  '🚗', '🚘', '🚙', '🚐', '🚌', '✈️', '🛬', '💼', '🕴️', '🎩',
  '💍', '🥂', '🍾', '⭐', '🏙️', '🌃', '🛎️', '🧳', '🚢', '🏨',
]

const inputCls =
  'text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface ' +
  'placeholder:text-sl-on-surface-muted/50 focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'

const norm = (s: string) => s.replace(/️/g, '')

function IconPicker({ name, defaultValue }: { name: string; defaultValue?: string | null }) {
  const match = defaultValue ? SERVICE_ICONS.find((i) => norm(i) === norm(defaultValue)) : undefined
  const [selected, setSelected] = useState(match ?? SERVICE_ICONS[0])
  return (
    <div>
      <input type="hidden" name={name} value={selected} />
      <div className="flex flex-wrap gap-1.5">
        {SERVICE_ICONS.map((ic) => (
          <button
            type="button"
            key={ic}
            onClick={() => setSelected(ic)}
            aria-label={ic}
            className={`h-9 w-9 rounded-lg border text-lg leading-none flex items-center justify-center transition-colors ${
              selected === ic ? 'border-bronze bg-bronze/10' : 'border-sl-outline-variant hover:bg-sl-bg'
            }`}
          >
            {ic}
          </button>
        ))}
      </div>
    </div>
  )
}

// Título + descripción por idioma (mismo patrón de pestañas que la portada:
// ES es el campo legado/obligatorio, EN/PT son traducciones opcionales).
function LangFields({
  t,
  initial,
}: {
  t: SettingsDict
  initial?: (loc: Locale) => { title: string; description: string }
}) {
  const [active, setActive] = useState<Locale>('es')
  return (
    <div className="flex-1 min-w-[260px]">
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted">{t.serviceTitleLabel}</label>
        <div className="flex gap-1 rounded-lg bg-sl-bg p-0.5">
          {LOCALES.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => setActive(loc)}
              className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors ${active === loc ? 'bg-bronze text-white' : 'text-sl-on-surface-muted hover:text-sl-on-surface'}`}
            >
              {loc.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      {LOCALES.map((loc) => {
        const val = initial?.(loc) ?? { title: '', description: '' }
        return (
          <div key={loc} className={active === loc ? 'flex flex-wrap gap-2' : 'hidden'}>
            <input
              name={`title_${loc}`}
              defaultValue={val.title}
              required={loc === 'es'}
              placeholder={`${t.serviceTitlePlaceholder} (${LOCALE_LABELS[loc]})`}
              className={`${inputCls} flex-1 min-w-[160px]`}
            />
            <input
              name={`description_${loc}`}
              defaultValue={val.description}
              placeholder={t.serviceDescLabel}
              className={`${inputCls} flex-1 min-w-[200px]`}
            />
          </div>
        )
      })}
    </div>
  )
}

function ServiceRow({ service, t, actions }: { service: Service; t: SettingsDict; actions: ActionsDict }) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isToggling, startToggle] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErr(null)
    startTransition(async () => {
      const res = await updateServiceAction(service.id, fd)
      if (res.success) setEditing(false)
      else setErr(res.error ?? 'Error')
    })
  }

  if (editing) {
    return (
      <li className="p-4 bg-sl-bg/40">
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1.5">{t.serviceIconLabel}</label>
            <IconPicker name="icon" defaultValue={service.icon} />
          </div>
          <div className="flex flex-wrap gap-2 items-start">
            <LangFields
              t={t}
              initial={(loc) =>
                loc === 'es'
                  ? { title: service.title, description: service.description ?? '' }
                  : { title: service.i18n?.[loc]?.title ?? '', description: service.i18n?.[loc]?.description ?? '' }
              }
            />
            <div className="flex items-center gap-3 pb-1">
              <button type="submit" disabled={isPending} className="px-3 py-2 text-sm font-semibold bg-gold text-gray-900 rounded-lg hover:bg-gold/90 disabled:opacity-60">
                {isPending ? actions.saving : actions.save}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="text-xs text-sl-on-surface-muted hover:text-sl-on-surface">
                {actions.cancel}
              </button>
            </div>
          </div>
        </form>
        {err && <p className="mt-2 text-xs text-red-500">{err}</p>}
      </li>
    )
  }

  return (
    <li className="flex items-center gap-3 p-4 hover:bg-sl-bg/40 transition-colors">
      <span className="text-xl w-8 text-center shrink-0">{service.icon || '✦'}</span>
      <div className="flex-1 min-w-0">
        <p className={`font-medium text-sm ${service.is_active ? 'text-sl-on-surface' : 'text-sl-on-surface-muted line-through'}`}>{service.title}</p>
        {service.description && <p className="text-xs text-sl-on-surface-muted truncate">{service.description}</p>}
      </div>
      <button
        onClick={() => startToggle(async () => { await toggleServiceActiveAction(service.id, !service.is_active) })}
        disabled={isToggling}
        className={`text-xs font-medium px-2 py-1 rounded-lg border ${service.is_active ? 'text-green-700 border-green-300 bg-green-50' : 'text-gray-500 border-gray-300 bg-gray-50'}`}
      >
        {service.is_active ? '●' : '○'}
      </button>
      <button
        onClick={() => setEditing(true)}
        title={actions.edit}
        aria-label={actions.edit}
        className="p-1.5 rounded-lg text-bronze hover:bg-bronze/10 transition-colors"
      >
        <Pencil size={14} strokeWidth={2} />
      </button>
      <button
        onClick={() => { if (confirm(actions.confirmDelete)) startToggle(async () => { await deleteServiceAction(service.id) }) }}
        title={actions.delete}
        aria-label={actions.delete}
        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
      >
        <Trash2 size={14} strokeWidth={2} />
      </button>
    </li>
  )
}

export function ServicesManager({ t, actions, services }: { t: SettingsDict; actions: ActionsDict; services: Service[] }) {
  const [isPending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErr(null)
    startTransition(async () => {
      const res = await createServiceAction(fd)
      if (res.success) formRef.current?.reset()
      else setErr(res.error ?? 'Error')
    })
  }

  return (
    <section className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6">
      <h2 className="text-sm font-semibold text-sl-on-surface mb-1">{t.servicesTitle}</h2>
      <p className="text-xs text-sl-on-surface-muted mb-5">{t.servicesDesc}</p>

      {/* Crear servicio */}
      <form ref={formRef} onSubmit={handleCreate} className="space-y-3 mb-5">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1.5">{t.serviceIconLabel}</label>
          <IconPicker name="icon" />
        </div>
        <div className="flex flex-wrap gap-2 items-start">
          <LangFields t={t} />
          <button type="submit" disabled={isPending} className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 disabled:opacity-60 shrink-0">
            {isPending ? actions.saving : t.addService}
          </button>
        </div>
      </form>
      {err && <p className="mb-3 text-xs text-red-500">{err}</p>}

      {/* Lista */}
      {services.length === 0 ? (
        <p className="text-sm text-sl-on-surface-muted text-center py-6">{t.noServices}</p>
      ) : (
        <ul className="border border-sl-outline-variant rounded-xl divide-y divide-sl-outline-variant/60 overflow-hidden">
          {services.map((s) => (
            <ServiceRow key={s.id} service={s} t={t} actions={actions} />
          ))}
        </ul>
      )}
    </section>
  )
}
