// ── Cron diario: follow-up de cotizaciones abandonadas ────────────────────────
// Busca reservas en estado 'quote' creadas hace entre 24 h y 7 días, con email
// del pasajero, y envía un recordatorio con el link público /quote/<id> para que
// el cliente la confirme. Solo se envía UNA vez por cotización (dedup vía la
// tabla notifications). Protegido con CRON_SECRET. Programado en vercel.json.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendQuoteFollowup } from '@/lib/notifications'
import { getAppUrl } from '@/lib/app-url'
import { buildQuoteFollowupSystemPrompt } from '@/lib/ai-growth/context'
import { getChatCompletion, isOpenAiConfigured } from '@/lib/ai-chat/openai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MIN_AGE_HOURS = 24
const MAX_AGE_DAYS = 7

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = Date.now()
  const newerThan = new Date(now - MAX_AGE_DAYS * 86_400_000).toISOString() // no más viejas que 7d
  const olderThan = new Date(now - MIN_AGE_HOURS * 3_600_000).toISOString() // al menos 24h

  const { data: quotes } = await admin
    .from('bookings')
    .select('id, company_id, booking_number, passenger_name, passenger_email, scheduled_at, total_amount, currency, companies(name)')
    .eq('status', 'quote')
    .not('passenger_email', 'is', null)
    .gte('created_at', newerThan)
    .lte('created_at', olderThan)
    .limit(300)

  // AI Growth Assistant — empresas con el add-on activo (ver lib/billing/ai-growth-addon.ts).
  const { data: aiGrowthAddons } = await admin
    .from('company_addons')
    .select('company_id')
    .in('addon_key', ['ai_growth_basic', 'ai_growth_plus'])
    .eq('enabled', true)
  const aiGrowthCompanyIds = new Set((aiGrowthAddons ?? []).map((a) => a.company_id))
  const openAiReady = isOpenAiConfigured()

  const appUrl = getAppUrl()
  let sent = 0

  for (const q of quotes ?? []) {
    const email = q.passenger_email
    if (!email) continue
    const companyName = (q.companies as { name?: string } | null)?.name ?? 'tu transportista'
    const amount = q.total_amount != null ? `$${Number(q.total_amount).toFixed(2)} ${q.currency ?? 'USD'}` : ''
    const when = new Date(q.scheduled_at).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' })
    const confirmUrl = `${appUrl}/quote/${q.id}`

    let body = [
      `Hola ${q.passenger_name ?? ''},`.trim(),
      '',
      `Tienes una cotización pendiente con ${companyName}` + (amount ? ` por ${amount}` : '') + '.',
      `Servicio programado para: ${when}.`,
      '',
      `Confírmala en un clic aquí: ${confirmUrl}`,
      '',
      `Si ya no la necesitas, puedes ignorar este mensaje.`,
    ].join('\n')

    // Si la empresa tiene el AI Growth Assistant activo, se reemplaza el texto
    // genérico por uno redactado por IA — nunca bloquea el envío si falla,
    // simplemente cae al texto de siempre.
    if (openAiReady && aiGrowthCompanyIds.has(q.company_id)) {
      const systemPrompt = buildQuoteFollowupSystemPrompt({
        companyName,
        passengerName: q.passenger_name,
        amount: amount || null,
        when,
        confirmUrl,
      })
      const completion = await getChatCompletion(systemPrompt, [{ role: 'user', content: 'Escribe el email de seguimiento.' }])
      if (completion.success) {
        body = completion.reply
        await admin.from('ai_growth_generations').insert({ company_id: q.company_id, type: 'quote_followup' })
      } else {
        console.error('[quote-followup] AI generation failed, usando texto genérico', completion.error)
      }
    }

    const result = await sendQuoteFollowup({
      companyId: q.company_id,
      bookingId: q.id,
      to: email,
      subject: `Tu cotización ${q.booking_number} | confírmala en un clic`,
      body,
    })
    if (result.sent) sent += 1
  }

  return NextResponse.json({ ok: true, candidates: quotes?.length ?? 0, sent })
}
