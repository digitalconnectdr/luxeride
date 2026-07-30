'use client'
// ── Google Ads: conversion tracking por operador ────────────────────────────
// Cada operador mide sus propias campañas con su propio GA4 Measurement ID
// (companies.settings.tracking.ga_measurement_id, configurado en
// /admin/settings) — distinto del GA4 propio de LuxeRide en app/layout.tsx,
// que cubre la plataforma entera, no las campañas de un operador puntual.
// Dispara un evento 'purchase' (value+currency) porque GA4 lo reconoce
// automáticamente para calcular ROAS al vincular con Google Ads, sin
// necesidad de configurar una conversión custom del lado del operador.

import { useEffect, useRef } from 'react'

interface ConversionTrackerProps {
  gaMeasurementId?: string | null
  transactionId: string
  value: number
  currency: string
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export function ConversionTracker({ gaMeasurementId, transactionId, value, currency }: ConversionTrackerProps) {
  const fired = useRef(false)

  useEffect(() => {
    if (!gaMeasurementId || fired.current) return
    fired.current = true

    const scriptId = `ga4-gtag-${gaMeasurementId}`
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script')
      script.id = scriptId
      script.async = true
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`
      document.head.appendChild(script)
    }

    window.dataLayer = window.dataLayer || []
    if (!window.gtag) {
      window.gtag = function gtag(...args: unknown[]) { window.dataLayer!.push(args) }
    }
    window.gtag('js', new Date())
    window.gtag('config', gaMeasurementId)
    window.gtag('event', 'purchase', {
      transaction_id: transactionId,
      value,
      currency,
    })
  }, [gaMeasurementId, transactionId, value, currency])

  return null
}
