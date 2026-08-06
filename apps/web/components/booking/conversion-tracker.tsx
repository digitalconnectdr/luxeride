'use client'
// ── Google Ads: conversion tracking por operador ────────────────────────────
// Cada operador mide sus propias campañas con su propio GA4 Measurement ID
// (companies.settings.tracking.ga_measurement_id, configurado en
// /admin/settings) — distinto del GA4 propio de LuxeRide en app/layout.tsx,
// que cubre la plataforma entera, no las campañas de un operador puntual.
// Dispara un evento 'purchase' (value+currency) porque GA4 lo reconoce
// automáticamente para calcular ROAS al vincular con Google Ads, sin
// necesidad de configurar una conversión custom del lado del operador.
//
// Si el operador además configuró un ID de conversión de Google Ads
// (companies.settings.tracking.ads_conversion_id/label — para operadores que
// corren campañas de Google Ads directamente, no solo enlazan GA4), se dispara
// TAMBIÉN un evento 'conversion' nativo de Ads con el mismo gtag.js — Google
// soporta múltiples destinos (GA4 + Ads) en un solo script cargado una vez.

import { useEffect, useRef } from 'react'

interface ConversionTrackerProps {
  gaMeasurementId?: string | null
  adsConversionId?: string | null
  adsConversionLabel?: string | null
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

export function ConversionTracker({
  gaMeasurementId,
  adsConversionId,
  adsConversionLabel,
  transactionId,
  value,
  currency,
}: ConversionTrackerProps) {
  const fired = useRef(false)

  useEffect(() => {
    if ((!gaMeasurementId && !adsConversionId) || fired.current) return
    fired.current = true

    const loaderId = gaMeasurementId || adsConversionId!
    const scriptId = `ads-gtag-${loaderId}`
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script')
      script.id = scriptId
      script.async = true
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(loaderId)}`
      document.head.appendChild(script)
    }

    window.dataLayer = window.dataLayer || []
    if (!window.gtag) {
      window.gtag = function gtag(...args: unknown[]) { window.dataLayer!.push(args) }
    }
    window.gtag('js', new Date())

    if (gaMeasurementId) {
      window.gtag('config', gaMeasurementId)
      window.gtag('event', 'purchase', {
        transaction_id: transactionId,
        value,
        currency,
      })
    }

    if (adsConversionId) {
      window.gtag('config', adsConversionId)
      window.gtag('event', 'conversion', {
        send_to: adsConversionLabel ? `${adsConversionId}/${adsConversionLabel}` : adsConversionId,
        transaction_id: transactionId,
        value,
        currency,
      })
    }
  }, [gaMeasurementId, adsConversionId, adsConversionLabel, transactionId, value, currency])

  return null
}
