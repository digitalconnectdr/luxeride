'use client'
// ── Chips de códigos postales — estilo Moovs ───────────────────────────────────
// Escribe un código y Enter (o coma) lo agrega como chip. Genera un hidden
// input por código con el MISMO name, así formData.getAll(name) trae la lista
// completa en el server action, sin depender de JSON.stringify en el cliente.

import { useState, type KeyboardEvent } from 'react'

export function PostalCodesInput({
  name = 'postal_codes',
  defaultValue = [],
  placeholder,
}: {
  name?: string
  defaultValue?: string[]
  placeholder?: string
}) {
  const [codes, setCodes] = useState<string[]>(defaultValue)
  const [draft, setDraft] = useState('')

  function addCode(raw: string) {
    const code = raw.trim()
    if (!code || codes.includes(code)) { setDraft(''); return }
    setCodes((prev) => [...prev, code])
    setDraft('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addCode(draft)
    } else if (e.key === 'Backspace' && !draft && codes.length) {
      setCodes((prev) => prev.slice(0, -1))
    }
  }

  return (
    <div>
      {codes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {codes.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1 text-xs bg-sl-bg border border-sl-outline-variant rounded-full pl-2.5 pr-1.5 py-1 text-sl-on-surface"
            >
              {c}
              <button
                type="button"
                onClick={() => setCodes((prev) => prev.filter((x) => x !== c))}
                className="text-sl-on-surface-muted hover:text-red-500 leading-none"
                aria-label={`Quitar ${c}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addCode(draft)}
        placeholder={placeholder}
        className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface placeholder:text-sl-on-surface-muted/50 focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
      />
      {codes.map((c) => (
        <input key={c} type="hidden" name={name} value={c} />
      ))}
    </div>
  )
}
