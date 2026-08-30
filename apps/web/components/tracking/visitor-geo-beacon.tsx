'use client'
// ── Beacon de visita al landing (mapa de geografía en /super-admin) ────────
// Montado una sola vez en el layout raíz (app/layout.tsx). Solo dispara en
// páginas públicas de marketing (home, money/solution/compare/info/resource
// pages, pricing, referral-program) - excluye paneles privados, el flujo de
// reserva de los micrositios y rutas técnicas, mismo criterio que
// app/robots.ts (más /book, /embed, /demo, /r: tráfico de pasajero, no de
// operador potencial evaluando la plataforma).

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

const EXCLUDED_PREFIXES = [
  '/admin', '/super-admin', '/dispatcher', '/corporate', '/driver', '/account',
  '/auth', '/api', '/track', '/payment', '/book', '/embed', '/demo', '/r',
  '/affiliate', '/quote', '/review',
]

function isExcluded(pathname: string): boolean {
  return EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function VisitorGeoBeacon() {
  const pathname = usePathname()
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current || !pathname || isExcluded(pathname)) return
    fired.current = true

    fetch('/api/track/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {
      // best-effort - nunca debe afectar la navegación del visitante
    })
  }, [pathname])

  return null
}
