// ── Meta Conversions API (server-side) — Fase 15, Google Ads Readiness/Meta Ads ──
// El Pixel del navegador (components/booking/meta-pixel-tracker.tsx) puede
// perderse por ad blockers o Safari ITP; la Conversions API envía el MISMO
// evento server-to-server directo a Meta, usando el mismo `eventId` para que
// Meta deduplique ambos lados y no cuente la conversión dos veces (patrón
// oficial de Meta: https://developers.facebook.com/docs/marketing-api/conversions-api).
// Cada operador usa su propio Pixel ID + access token (companies.settings.tracking),
// nunca el de LuxeRide - misma separación que ya existe para GA4/Google Ads
// en components/booking/conversion-tracker.tsx.

import { createHash } from 'crypto'
import { waitUntil } from '@vercel/functions'

const META_GRAPH_VERSION = 'v21.0'

function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

interface MetaPurchaseEventInput {
  pixelId: string
  accessToken: string
  eventId: string
  eventSourceUrl: string
  value: number
  currency: string
  clientIp?: string
  userAgent?: string
  email?: string | null
  phone?: string | null
}

async function sendMetaPurchaseEvent(input: MetaPurchaseEventInput): Promise<void> {
  const userData: Record<string, unknown> = {}
  if (input.clientIp) userData.client_ip_address = input.clientIp
  if (input.userAgent) userData.client_user_agent = input.userAgent
  if (input.email) userData.em = [sha256(input.email)]
  if (input.phone) userData.ph = [sha256(input.phone.replace(/[^\d]/g, ''))]

  const body = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        event_source_url: input.eventSourceUrl,
        action_source: 'website',
        user_data: userData,
        custom_data: {
          value: input.value,
          currency: input.currency,
        },
      },
    ],
  }

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${input.pixelId}/events?access_token=${encodeURIComponent(input.accessToken)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`Meta CAPI ${res.status}: ${errBody.slice(0, 500)}`)
  }
}

/** Fire-and-forget vía waitUntil (no bloquea el render de la página de éxito). */
export function sendMetaPurchaseEventInBackground(input: MetaPurchaseEventInput): void {
  waitUntil(
    sendMetaPurchaseEvent(input).catch((err) => {
      console.error('[sendMetaPurchaseEventInBackground]', err)
    }),
  )
}
