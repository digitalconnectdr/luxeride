'use client'
// Meta Pixel del operador (Facebook/Instagram Ads) — mismo patrón de
// ConversionTracker (components/booking/conversion-tracker.tsx) pero para
// Meta en vez de Google. `eventId` viaja también al server (lib/tracking/meta-capi.ts,
// llamado desde app/payment/success/page.tsx) para que Meta deduplique el
// evento del navegador con el de la Conversions API.

import { useEffect, useRef } from 'react'

interface MetaPixelTrackerProps {
  pixelId: string
  eventId: string
  value: number
  currency: string
}

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string }
    _fbq?: unknown
  }
}

export function MetaPixelTracker({ pixelId, eventId, value, currency }: MetaPixelTrackerProps) {
  const fired = useRef(false)

  useEffect(() => {
    if (!pixelId || fired.current) return
    fired.current = true

    if (!window.fbq) {
      // Stub mínimo del snippet oficial de Meta: encola las llamadas hasta que
      // fbevents.js termine de cargar y reemplace window.fbq por la versión real.
      const fbq: NonNullable<Window['fbq']> = function fbqStub(...args: unknown[]) {
        fbq.queue!.push(args)
      }
      window.fbq = fbq
      window._fbq = fbq
      fbq.queue = []
      fbq.loaded = true
      fbq.version = '2.0'

      const script = document.createElement('script')
      script.async = true
      script.src = 'https://connect.facebook.net/en_US/fbevents.js'
      document.head.appendChild(script)
    }

    window.fbq('init', pixelId)
    window.fbq('track', 'Purchase', { value, currency }, { eventID: eventId })
  }, [pixelId, eventId, value, currency])

  return null
}
