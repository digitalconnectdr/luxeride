'use client'

import { useRef, useState, useTransition, type FormEvent } from 'react'
import {
  createServiceAction,
  updateServiceAction,
  toggleServiceActiveAction,
  deleteServiceAction,
} from '@/app/actions/microsite'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type SettingsDict = Dictionary['admin']['settings']
type ActionsDict = Dictionary['admin']['actions']

export interface Service {
  id: string
  title: string
  description: string | null
  icon: string | null
  is_active: boolean
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
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.serviceTitleLabel}</label>
              <input name="title" defaultValue={service.title} required className={`${inputCls} w-full`} />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.serviceDescLabel}</label>
              <input name="description" defaultValue={service.description ?? ''} className={`${inputCls} w-full`} />
            </div>
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
      <button onClick={() => setEditing(true)} className="text-xs font-medium text-bronze hover:text-bronze/80">{actions.edit}</button>
      <button
        onClick={() => { if (confirm(actions.confirmDelete)) startToggle(async () => { await deleteServiceAction(service.id) }) }}
        className="text-xs font-medium text-red-500 hover:text-red-700"
      >
        {actions.delete}
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
    <section className="bg-sl-surface border border-sl-outline-variant rounded-xl p-6">
      <h2 className="text-sm font-semibold text-sl-on-surface mb-1">{t.servicesTitle}</h2>
      <p className="text-xs text-sl-on-surface-muted mb-5">{t.servicesDesc}</p>

      {/* Crear servicio */}
      <form ref={formRef} onSubmit={handleCreate} className="space-y-3 mb-5">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1.5">{t.serviceIconLabel}</label>
          <IconPicker name="icon" />
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.serviceTitleLabel}</label>
            <input name="title" required placeholder={t.serviceTitlePlaceholder} className={`${inputCls} w-full`} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.serviceDescLabel}</label>
            <input name="description" className={`${inputCls} w-full`} />
          </div>
          <button type="submit" disabled={isPending} className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 disabled:opacity-60">
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
