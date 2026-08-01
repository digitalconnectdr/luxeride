'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { CalendarDays, Trash2 } from 'lucide-react'
import { addCompanyHolidayAction, deleteCompanyHolidayAction } from '@/app/actions/holidays'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type HolidaysDict = Dictionary['admin']['pricing']['holidays']
type ActionsDict = Dictionary['admin']['actions']

export interface CompanyHoliday {
  id: string
  holiday_date: string
  name: string
}

const inputCls =
  'w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface ' +
  'placeholder:text-sl-on-surface-muted/60 focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'

/**
 * Fecha en el huso de la EMPRESA sin pasar por Date: `holiday_date` es un DATE
 * puro ('2026-12-25'). `new Date('2026-12-25')` lo interpreta como medianoche
 * UTC y en zonas al oeste se muestra un día antes — justo el bug que este
 * módulo existe para evitar.
 */
function formatIsoDate(iso: string, locale: string): string {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10))
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function CompanyHolidays({
  holidays,
  todayIso,
  locale,
  t,
  actions,
}: {
  holidays: CompanyHoliday[]
  /** Hoy en la zona horaria de la empresa, calculado en el servidor. */
  todayIso: string
  locale: string
  t: HolidaysDict
  actions: ActionsDict
}) {
  const [isPending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    setErr(null)
    startTransition(async () => {
      const res = await addCompanyHolidayAction(fd)
      if (res.success) form.reset()
      else setErr(res.error ?? 'Error')
    })
  }

  return (
    <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-sl-outline-variant/60 flex items-start gap-3">
        <span className="shrink-0 w-8 h-8 rounded-lg bg-gold/15 text-bronze flex items-center justify-center">
          <CalendarDays size={16} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-sl-on-surface">{t.title}</h2>
          <p className="text-xs text-sl-on-surface-muted mt-0.5 max-w-[70ch]">{t.subtitle}</p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="px-5 py-4 border-b border-sl-outline-variant/60">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="sm:w-48">
            <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">
              {t.dateLabel}
            </label>
            <input name="holiday_date" type="date" required className={inputCls} />
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">
              {t.nameLabel}
            </label>
            <input name="name" required maxLength={120} placeholder={t.namePlaceholder} className={inputCls} />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="shrink-0 px-4 py-2 text-sm font-semibold bg-gold text-gray-900 rounded-lg hover:bg-gold/90 disabled:opacity-60 transition-colors"
          >
            {isPending ? actions.saving : t.addButton}
          </button>
        </div>
        {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      </form>

      {holidays.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-sl-on-surface-muted">{t.empty}</p>
      ) : (
        <ul className="divide-y divide-sl-outline-variant/50">
          {holidays.map((h) => {
            const isPast = h.holiday_date < todayIso
            return (
              <li key={h.id} className="flex items-center gap-3 px-5 py-3">
                <span
                  className={`text-sm tabular-nums ${isPast ? 'text-sl-on-surface-muted' : 'text-sl-on-surface font-medium'}`}
                >
                  {formatIsoDate(h.holiday_date, locale)}
                </span>
                <span className={`flex-1 min-w-0 truncate text-sm ${isPast ? 'text-sl-on-surface-muted' : 'text-sl-on-surface'}`}>
                  {h.name}
                </span>
                {isPast && (
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-sl-on-surface-muted border border-sl-outline-variant rounded-full px-2 py-0.5">
                    {t.pastLabel}
                  </span>
                )}
                <DeleteHolidayButton holidayId={h.id} name={h.name} confirmTemplate={t.confirmDelete} />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function DeleteHolidayButton({
  holidayId,
  name,
  confirmTemplate,
}: {
  holidayId: string
  name: string
  confirmTemplate: string
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm(confirmTemplate.replace('{name}', name))) return
        startTransition(async () => {
          await deleteCompanyHolidayAction(holidayId)
        })
      }}
      title={name}
      aria-label={name}
      className="shrink-0 p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
    >
      {isPending ? <span className="text-xs">…</span> : <Trash2 size={14} strokeWidth={2} />}
    </button>
  )
}
