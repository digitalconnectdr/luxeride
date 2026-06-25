'use client'
// ── Selector de idioma — dropdown custom (el <select> nativo mostraba el menú
// del sistema operativo, ilegible sobre el nav oscuro). Setea cookie + refresh.

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LOCALES, LOCALE_COOKIE, LOCALE_LABELS, type Locale } from '@/lib/i18n/config'

const FLAGS: Record<Locale, string> = { en: '🇺🇸', es: '🇪🇸', pt: '🇧🇷' }

export function LanguageSwitcher({
  current,
  variant = 'dark',
}: {
  current: Locale
  variant?: 'dark' | 'light'
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  // Cerrar al hacer clic fuera o con Escape
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function select(locale: Locale) {
    setOpen(false)
    if (locale === current) return
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`
    startTransition(() => router.refresh())
  }

  const dark = variant === 'dark'

  const buttonCls = dark
    ? 'border-white/15 text-white/70 hover:border-[#e9c176]/60 hover:text-white'
    : 'border-[#e5e1d8] bg-white text-[#75716a] hover:border-bronze hover:text-[#1d1b18]'

  const menuCls = dark
    ? 'bg-[#1c1916] border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.5)]'
    : 'bg-white border-[#e5e1d8] shadow-[0_8px_30px_rgba(29,27,24,0.12)]'

  const itemCls = (active: boolean) =>
    dark
      ? active
        ? 'bg-[#e9c176]/15 text-[#e9c176]'
        : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
      : active
        ? 'bg-[#f1ecdf] text-bronze font-medium'
        : 'text-[#4e4639] hover:bg-[#faf8f3] hover:text-[#1d1b18]'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        aria-label="Language"
        aria-expanded={open}
        className={`flex items-center gap-1.5 text-xs rounded-full border px-3 py-1.5 cursor-pointer transition-colors disabled:opacity-50 ${buttonCls}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" />
        </svg>
        <span>{LOCALE_LABELS[current]}</span>
        <svg
          width="10" height="10" viewBox="0 0 10 10" aria-hidden
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2 3.5L5 6.5L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute right-0 top-full mt-2 z-50 min-w-[150px] rounded-xl border p-1.5 ${menuCls}`}
        >
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              role="option"
              aria-selected={l === current}
              onClick={() => select(l)}
              className={`w-full flex items-center gap-2.5 text-left text-[13px] rounded-lg px-3 py-2 transition-colors ${itemCls(l === current)}`}
            >
              <span aria-hidden>{FLAGS[l]}</span>
              <span className="flex-1">{LOCALE_LABELS[l]}</span>
              {l === current && (
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                  <path d="M2.5 6.5L5 9L9.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
