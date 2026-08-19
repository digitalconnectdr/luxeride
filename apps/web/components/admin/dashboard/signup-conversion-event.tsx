'use client'

// Google Ads readiness (Fase 14): el GA4 de la plataforma (app/layout.tsx)
// ya carga gtag.js en cada página, pero ningún flujo disparaba un evento
// de conversión al completar el signup - sin eso, una campaña de Google Ads
// apuntando a las money pages no tiene señal de qué visita se convirtió en
// operador nuevo. signupAction redirige aquí con ?welcome=1 solo la primera
// vez; se dispara 'sign_up' (evento estándar de GA4, reconocible por Google
// Ads al importar conversiones) y se limpia el query param para no repetir
// el conteo en refrescos posteriores del dashboard.

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export function SignupConversionEvent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Mismo guard que ConversionTracker (components/booking/conversion-tracker.tsx)
  // - sin él, el doble-invoke de efectos en dev (React Strict Mode) dispara
  // 'sign_up' dos veces antes de que router.replace() limpie ?welcome=1.
  const fired = useRef(false)

  useEffect(() => {
    if (searchParams.get('welcome') !== '1' || fired.current) return
    fired.current = true

    if (window.gtag) {
      window.gtag('event', 'sign_up', { method: 'company_signup' })
    }

    router.replace('/admin/dashboard')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return null
}
