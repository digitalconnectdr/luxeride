'use client'

import { useState } from 'react'
import { ChevronDown, HelpCircle } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type FaqDict = Dictionary['admin']['pricing']['faq']

/**
 * Ayuda de la pestaña "Reglas de precio": cómo se elige la regla, cómo se
 * acumulan los recargos, qué pasa si nada aplica. Los InfoTip de cada campo
 * explican QUÉ es el campo; esto explica cómo se comportan juntos, que es
 * donde una empresa se equivoca al configurar.
 *
 * Arranca colapsado: quien ya sabe configurar no necesita verlo cada vez.
 */
export function PricingFaq({ t }: { t: FaqDict }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-sl-bg/40 transition-colors"
      >
        <span className="shrink-0 w-8 h-8 rounded-lg bg-gold/15 text-bronze flex items-center justify-center">
          <HelpCircle size={16} strokeWidth={2} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-sl-on-surface">{t.title}</span>
          <span className="block text-xs text-sl-on-surface-muted mt-0.5">{t.subtitle}</span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          className={`shrink-0 text-sl-on-surface-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-sl-outline-variant/60 divide-y divide-sl-outline-variant/50">
          {t.items.map((item, i) => {
            const isOpen = openIndex === i
            return (
              <div key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="w-full flex items-start gap-3 px-5 py-3.5 text-left hover:bg-sl-bg/40 transition-colors"
                >
                  <span className="flex-1 text-sm font-medium text-sl-on-surface">{item.q}</span>
                  <ChevronDown
                    size={14}
                    strokeWidth={2}
                    className={`shrink-0 mt-0.5 text-sl-on-surface-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <p className="px-5 pb-4 -mt-1 text-sm leading-relaxed text-sl-on-surface-muted max-w-[75ch]">
                    {item.a}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
