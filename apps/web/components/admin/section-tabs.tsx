'use client'
// ── Pestañas de sección para páginas admin largas ────────────────────────────
// Páginas como Precios y Configuración acumularon más de una decena de bloques
// en un solo scroll, donde nadie encuentra nada sin buscar a ciegas. Este
// componente las parte por tema.
//
// Los paneles llegan como ReactNode ya renderizados en el servidor: así los
// formularios siguen siendo server components con sus server actions, y este
// componente solo decide cuál se muestra.

import { useEffect, useState, type ReactNode } from 'react'

export interface SectionTab<K extends string> {
  key: K
  label: string
  /**
   * Ids de ancla que viven dentro de este panel (ej. 'subscription'). Existen
   * enlaces externos —correos del cron, el checklist de onboarding, el banner
   * de error— que apuntan a `/admin/settings#subscription`. Sin esto, al
   * meter las secciones en pestañas esos enlaces caerían en una pestaña
   * inactiva y no llevarían a ninguna parte.
   */
  anchors?: string[]
}

export function SectionTabs<K extends string>({
  tabs,
  panels,
  ariaLabel,
}: {
  tabs: readonly SectionTab<K>[]
  panels: Record<K, ReactNode>
  ariaLabel: string
}) {
  // El estado inicial es siempre la primera pestaña: leer `location.hash`
  // durante el render daría un HTML distinto en servidor y cliente.
  const [tab, setTab] = useState<K>(tabs[0].key)

  useEffect(() => {
    function selectFromHash() {
      const id = window.location.hash.slice(1)
      if (!id) return
      const target = tabs.find((t) => t.anchors?.includes(id))
      if (!target) return
      setTab(target.key)
      // La sección aún no está en el DOM en este tick — se acaba de pedir el
      // cambio de pestaña. Se espera al siguiente frame para poder desplazar.
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }

    selectFromHash()
    window.addEventListener('hashchange', selectFromHash)
    return () => window.removeEventListener('hashchange', selectFromHash)
  }, [tabs])

  return (
    <div className="space-y-5">
      {/* En móvil el grupo de píldoras se desborda; scroll horizontal propio
          para que la página nunca scrollee de lado. */}
      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <div
          role="tablist"
          aria-label={ariaLabel}
          className="inline-flex items-center gap-1 bg-sl-surface-variant/50 rounded-full p-1 border border-sl-outline-variant"
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                tab === t.key
                  ? 'bg-gold text-white shadow-sm'
                  : 'text-sl-on-surface-muted hover:text-sl-on-surface'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Solo se monta el panel activo: los formularios son no-controlados
          (defaultValue), así que mantener todos montados haría que un cambio
          sin guardar sobreviviera al cambio de pestaña y diera la impresión
          de estar guardado. */}
      <div role="tabpanel" className="space-y-5">
        {panels[tab]}
      </div>
    </div>
  )
}
