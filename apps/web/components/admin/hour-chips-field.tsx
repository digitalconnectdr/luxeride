'use client'
// ── Chips de horas (umbrales de recordatorio) ──────────────────────────────
// Mismo patrón que ZoneGeoFields (códigos postales): chips visuales + input
// que agrega con Enter/coma/blur, persistido como inputs ocultos repetidos
// bajo la misma `name` (el server action los lee con formData.getAll).

import { useState, type KeyboardEvent } from 'react'

const MAX_HOURS = 168 // 7 días

export function HourChipsField({
  name,
  defaultValues = [],
  placeholder,
}: {
  name: string
  defaultValues?: number[]
  placeholder?: string
}) {
  const [values, setValues] = useState<number[]>(defaultValues)
  const [draft, setDraft] = useState('')

  function addValue(raw: string) {
    const n = parseInt(raw, 10)
    if (!Number.isInteger(n) || n < 1 || n > MAX_HOURS || values.includes(n)) {
      setDraft('')
      return
    }
    setValues((prev) => [...prev, n].sort((a, b) => a - b))
    setDraft('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addValue(draft)
    } else if (e.key === 'Backspace' && !draft && values.length) {
      setValues((prev) => prev.slice(0, -1))
    }
  }

  return (
    <div className="space-y-1.5">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 text-xs bg-sl-bg border border-sl-outline-variant rounded-full pl-2.5 pr-1.5 py-1 text-sl-on-surface"
            >
              {v}h
              <button
                type="button"
                onClick={() => setValues((prev) => prev.filter((x) => x !== v))}
                className="text-sl-on-surface-muted hover:text-red-500 leading-none"
                aria-label={`Quitar ${v}h`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="number"
        min={1}
        max={MAX_HOURS}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addValue(draft)}
        placeholder={placeholder}
        className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface placeholder:text-sl-on-surface-muted/50 focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
      />
      {values.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
    </div>
  )
}
