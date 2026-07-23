'use client'
// ── AI Growth Assistant — selector de pestañas ─────────────────────────────
// Primera vez que esta página usa pestañas (antes era una sola columna
// lineal: tarjeta de uso + generador). Estilo pill-tab consistente con el
// resto del sistema de diseño admin.

import { useState } from 'react'
import type { Dictionary } from '@/lib/i18n/server'
import { ContentGenerator } from './content-generator'
import { RouteInsightsReport } from './route-insights-report'

type T = Dictionary['admin']['growthAssistant']

interface UsageProps {
  tierLabel: string
  price: number
  used: number
  quota: number
  over: number
  overagePrice: number
  pct: number
}

export function GrowthAssistantTabs({ t, usage }: { t: T; usage: UsageProps }) {
  const [tab, setTab] = useState<'content' | 'routes'>('content')

  return (
    <div className="space-y-6">
      <div className="inline-flex items-center gap-1 bg-sl-surface-variant/50 rounded-full p-1 border border-sl-outline-variant">
        <button
          type="button"
          onClick={() => setTab('content')}
          className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
            tab === 'content' ? 'bg-gold text-white shadow-sm' : 'text-sl-on-surface-muted hover:text-sl-on-surface'
          }`}
        >
          {t.tabContent}
        </button>
        <button
          type="button"
          onClick={() => setTab('routes')}
          className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
            tab === 'routes' ? 'bg-gold text-white shadow-sm' : 'text-sl-on-surface-muted hover:text-sl-on-surface'
          }`}
        >
          {t.tabRoutes}
        </button>
      </div>

      {tab === 'content' && (
        <div className="space-y-6">
          <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6 max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-sl-on-surface-muted">{t.activeTier}</p>
              <span className="text-sm font-semibold text-sl-on-surface capitalize">
                {usage.tierLabel} — ${usage.price}/mes
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-sl-on-surface-muted">{t.usageTitle}</p>
                <p className="text-xs text-sl-on-surface">
                  {t.generationsUsed.replace('{used}', String(usage.used)).replace('{quota}', String(usage.quota))}
                </p>
              </div>
              <div className="h-2 rounded-full bg-sl-outline-variant overflow-hidden">
                <div className="h-full bg-bronze" style={{ width: `${usage.pct}%` }} />
              </div>
            </div>

            {usage.over > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {t.overageNote.replace('{over}', String(usage.over)).replace('{price}', String(usage.overagePrice))}
              </p>
            )}

            <p className="text-xs text-sl-on-surface-muted">{t.followupNote}</p>
          </div>

          <ContentGenerator t={t} />
        </div>
      )}

      {tab === 'routes' && <RouteInsightsReport t={t} />}
    </div>
  )
}
