'use client'
// ── Precios: selector de pestañas ─────────────────────────────────────────────
// Todo lo que la empresa cobra vivía repartido entre esta página (reglas) y
// Configuración (propinas, cargos extra, depósito, política de cancelación),
// obligando a saltar de un lado a otro para armar un precio. Aquí se agrupa.
//
// Los paneles llegan como ReactNode ya renderizados en el servidor: así los
// formularios siguen siendo server components con sus server actions, y este
// componente solo decide cuál se muestra.

import { useState, type ReactNode } from 'react'

export type PricingTabKey = 'rules' | 'surcharges' | 'policy' | 'holidays'

export function PricingTabs({
  labels,
  panels,
}: {
  labels: Record<PricingTabKey, string>
  panels: Record<PricingTabKey, ReactNode>
}) {
  const [tab, setTab] = useState<PricingTabKey>('rules')
  const keys: PricingTabKey[] = ['rules', 'surcharges', 'policy', 'holidays']

  return (
    <div className="space-y-5">
      {/* En móvil el grupo de píldoras se desborda; scroll horizontal propio
          para que la página nunca scrollee de lado. */}
      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <div
          role="tablist"
          aria-label="Precios"
          className="inline-flex items-center gap-1 bg-sl-surface-variant/50 rounded-full p-1 border border-sl-outline-variant"
        >
          {keys.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                tab === key
                  ? 'bg-gold text-white shadow-sm'
                  : 'text-sl-on-surface-muted hover:text-sl-on-surface'
              }`}
            >
              {labels[key]}
            </button>
          ))}
        </div>
      </div>

      {/* Solo se monta el panel activo: los formularios son no-controlados
          (defaultValue), así que mantener los cuatro montados haría que un
          cambio sin guardar sobreviviera al cambio de pestaña y diera la
          impresión de estar guardado. */}
      <div role="tabpanel" className="space-y-5">
        {panels[tab]}
      </div>
    </div>
  )
}
