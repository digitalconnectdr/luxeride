// ── Marca white-label de la empresa ────────────────────────────────────────
// Este build de la app representa a UNA empresa (EXPO_PUBLIC_COMPANY_SLUG —
// ver Sprint 0-1 del plan; builds de marca propia por operador son un
// upsell Enterprise futuro, ver docs/PHASE-2-MOBILE.md). Pero el logo,
// nombre y color que se ven DENTRO de la app nunca deben quedar fijos en el
// código — se piden en runtime a /api/mobile/passenger/branding (mismo
// patrón que ya usa la web en quote/[id] y review/[id]: logo_url/primary_color
// de `companies`, con inicial del nombre como respaldo si no hay logo).
//
// Esto es lo que hace que la MISMA app instalada muestre la identidad de
// CADA empresa que la usa, sin tocar código por cliente.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { darkPalette } from './theme'

export interface Branding {
  name: string
  logoUrl: string | null
  primaryColor: string
  /** Contacto de la EMPRESA OPERADORA — para dudas sobre el servicio. Un
   * problema con la app se reporta aparte, desde el Centro de ayuda. */
  supportPhone: string | null
  supportEmail: string | null
}

const DEFAULT_BRANDING: Branding = {
  name: 'LuxeRide',
  logoUrl: null,
  primaryColor: darkPalette.gold,
  supportPhone: null,
  supportEmail: null,
}

const BrandingContext = createContext<{ branding: Branding; loading: boolean }>({
  branding: DEFAULT_BRANDING,
  loading: true,
})

export function useBranding() {
  return useContext(BrandingContext)
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const slug = process.env.EXPO_PUBLIC_COMPANY_SLUG
    const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL

    async function load() {
      if (!slug) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch(`${apiBaseUrl}/api/mobile/passenger/branding`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companySlug: slug }),
        })
        const json = await res.json()
        if (!cancelled && json?.success) {
          setBranding({
            name: json.name ?? DEFAULT_BRANDING.name,
            logoUrl: json.logoUrl ?? null,
            primaryColor: json.primaryColor || DEFAULT_BRANDING.primaryColor,
            supportPhone: json.supportPhone ?? null,
            supportEmail: json.supportEmail ?? null,
          })
        }
      } catch {
        // Sin conexión — se queda con la marca por defecto, no bloquea la app.
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return <BrandingContext.Provider value={{ branding, loading }}>{children}</BrandingContext.Provider>
}
