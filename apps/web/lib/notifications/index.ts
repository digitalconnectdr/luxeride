// ── F1.14 — Notificaciones (Email vía Resend + SMS vía Twilio) ────────────────
// Server-only. Placeholder-safe: sin API keys reales, la notificación se registra
// en la tabla `notifications` con status 'pending' y no se envía nada.
//
// Flujo: notify() → busca template (empresa → default del sistema) → renderiza
// {{variables}} → respeta settings.notifications de la empresa → envía → registra.

import { waitUntil } from '@vercel/functions'
import { createAdminClient } from '@/lib/supabase/server'
import { brand } from '@/lib/brand'
import type { NotificationChannel } from '@/lib/supabase/database.types'

// ─── Configuración de proveedores ─────────────────────────────────────────────

export function isResendConfigured(): boolean {
  return /^re_[A-Za-z0-9_]{8,}/.test(process.env.RESEND_API_KEY ?? '')
}

export function isTwilioConfigured(): boolean {
  return (
    /^AC[a-f0-9]{16,}/i.test(process.env.TWILIO_ACCOUNT_SID ?? '') &&
    Boolean(process.env.TWILIO_AUTH_TOKEN) &&
    Boolean(process.env.TWILIO_FROM_NUMBER)
  )
}

// ─── Renderizado de templates ─────────────────────────────────────────────────

export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}

// ─── Envío de email (Resend) ──────────────────────────────────────────────────

async function sendEmail(
  to: string,
  subject: string,
  body: string,
  companyName?: string | null,
  branding?: { logoUrl?: string | null; brandColor?: string | null },
): Promise<{ ok: boolean; providerId?: string; error?: string }> {
  if (!isResendConfigured()) {
    return { ok: false, error: 'RESEND_API_KEY no configurada' }
  }
  try {
    const { Resend } = await import('resend')
    const { wrapEmailHtml } = await import('./email-template')
    const resend = new Resend(process.env.RESEND_API_KEY!)
    const from = process.env.RESEND_FROM_EMAIL ?? 'notifications@luxeride.app'

    const { data, error } = await resend.emails.send({
      from: `${companyName ?? brand.name} <${from}>`,
      to,
      subject,
      text: body, // fallback para clientes sin HTML
      html: wrapEmailHtml({ body, companyName, heading: subject, logoUrl: branding?.logoUrl, brandColor: branding?.brandColor }),
    })

    if (error) return { ok: false, error: error.message }
    return { ok: true, providerId: data?.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error de envío' }
  }
}

// ─── Envío de SMS (Twilio) ────────────────────────────────────────────────────

async function sendSms(
  to: string,
  body: string,
): Promise<{ ok: boolean; providerId?: string; error?: string }> {
  if (!isTwilioConfigured()) {
    return { ok: false, error: 'Twilio no configurado' }
  }
  try {
    const twilio = (await import('twilio')).default
    const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)

    const message = await client.messages.create({
      from: process.env.TWILIO_FROM_NUMBER!,
      to,
      body,
    })
    return { ok: true, providerId: message.sid }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error de envío SMS' }
  }
}

// ─── Settings de notificaciones de la empresa ─────────────────────────────────

interface NotificationSettings {
  email_enabled?: boolean
  sms_enabled?: boolean
  [key: string]: boolean | undefined
}

function parseNotificationSettings(settings: unknown): NotificationSettings {
  return ((settings as { notifications?: NotificationSettings } | null)?.notifications) ?? {}
}

// ─── API principal ────────────────────────────────────────────────────────────

export interface NotifyParams {
  companyId: string
  channel: NotificationChannel
  /** Tipo de template: 'booking_confirmation', 'driver_assigned', etc. */
  type: string
  /** Email o teléfono del destinatario */
  recipient: string
  /** Variables para el template {{var}} */
  vars: Record<string, string>
  bookingId?: string
  userId?: string
}

/**
 * Envía una notificación usando el template de la empresa (o el default del
 * sistema) y la registra en la tabla `notifications`.
 * NUNCA lanza — los errores se registran y se devuelve { sent: false }.
 */
export async function notify(params: NotifyParams): Promise<{ sent: boolean }> {
  try {
    const admin = createAdminClient()

    // Settings de la empresa: ¿canal habilitado? ¿tipo habilitado?
    const { data: company } = await admin
      .from('companies')
      .select('settings, name, logo_url, primary_color')
      .eq('id', params.companyId)
      .single()

    const ns = parseNotificationSettings(company?.settings)
    if (params.channel === 'email' && ns.email_enabled === false) return { sent: false }
    if (params.channel === 'sms' && ns.sms_enabled === false) return { sent: false }
    if (ns[params.type] === false) return { sent: false }

    // Template: específico de la empresa → default del sistema (company_id NULL)
    const { data: templates } = await admin
      .from('notification_templates')
      .select('id, company_id, subject, body, is_active')
      .eq('channel', params.channel)
      .eq('type', params.type)
      .eq('is_active', true)
      .or(`company_id.eq.${params.companyId},company_id.is.null`)

    const template =
      templates?.find((t) => t.company_id === params.companyId) ??
      templates?.find((t) => t.company_id === null)

    if (!template) return { sent: false }

    const body = renderTemplate(template.body, params.vars)
    const subject = template.subject ? renderTemplate(template.subject, params.vars) : null

    // Enviar
    let result: { ok: boolean; providerId?: string; error?: string }
    if (params.channel === 'email') {
      result = await sendEmail(params.recipient, subject ?? brand.name, body, company?.name, {
        logoUrl: (company as { logo_url?: string | null })?.logo_url ?? null,
        brandColor: (company as { primary_color?: string | null })?.primary_color ?? null,
      })
    } else if (params.channel === 'sms') {
      result = await sendSms(params.recipient, body)
    } else {
      result = { ok: false, error: `Canal ${params.channel} no soportado todavía` }
    }

    const configured =
      params.channel === 'email' ? isResendConfigured() : isTwilioConfigured()

    // Registrar SIEMPRE (auditoría). Si el proveedor no está configurado,
    // queda 'pending' para reintento futuro; si falló el envío, 'failed'.
    await admin.from('notifications').insert({
      company_id: params.companyId,
      user_id: params.userId ?? null,
      booking_id: params.bookingId ?? null,
      template_id: template.id,
      channel: params.channel,
      type: params.type,
      recipient: params.recipient,
      subject,
      body,
      status: result.ok ? 'sent' : configured ? 'failed' : 'pending',
      provider_id: result.providerId ?? null,
      error_message: result.ok ? null : result.error ?? null,
      sent_at: result.ok ? new Date().toISOString() : null,
    })

    return { sent: result.ok }
  } catch (err) {
    console.error('[notify]', err)
    return { sent: false }
  }
}

// ─── Helper de alto nivel: notificar evento de booking ────────────────────────

export interface BookingNotificationData {
  companyId: string
  bookingId: string
  bookingNumber: string
  passengerName: string | null
  passengerEmail: string | null
  passengerPhone: string | null
  scheduledAt: string
  pickupAddress: string
  dropoffAddress: string
  totalAmount: number | null
  currency: string
  extraVars?: Record<string, string>
}

/**
 * Envía email + SMS (si hay destinatarios) para un evento del booking.
 * Tipos: booking_confirmation, driver_assigned, driver_en_route,
 * driver_arrived, trip_completed, booking_cancelled.
 */
export async function notifyBookingEvent(
  type: string,
  data: BookingNotificationData,
): Promise<void> {
  const vars: Record<string, string> = {
    booking_number: data.bookingNumber,
    passenger_name: data.passengerName ?? 'Cliente',
    scheduled_at: new Date(data.scheduledAt).toLocaleString('es-DO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
    pickup_address: data.pickupAddress,
    dropoff_address: data.dropoffAddress,
    total_amount:
      data.totalAmount != null
        ? `$${Number(data.totalAmount).toFixed(2)} ${data.currency}`
        : '',
    ...data.extraVars,
  }

  const jobs: Promise<{ sent: boolean }>[] = []

  if (data.passengerEmail) {
    jobs.push(
      notify({
        companyId: data.companyId,
        channel: 'email',
        type,
        recipient: data.passengerEmail,
        vars,
        bookingId: data.bookingId,
      }),
    )
  }

  if (data.passengerPhone) {
    jobs.push(
      notify({
        companyId: data.companyId,
        channel: 'sms',
        type,
        recipient: data.passengerPhone,
        vars,
        bookingId: data.bookingId,
      }),
    )
  }

  await Promise.allSettled(jobs)
}

/**
 * Versión NO bloqueante de notifyBookingEvent: la server action responde de
 * inmediato y el envío continúa en background (waitUntil de Vercel mantiene
 * viva la función serverless hasta que termine; en dev local el proceso es
 * long-running, así que el promise flotante también completa).
 */
export function notifyBookingEventInBackground(
  type: string,
  data: BookingNotificationData,
): void {
  const job = notifyBookingEvent(type, data).catch((err) => {
    console.error('[notifyBookingEventInBackground]', err)
  })
  // waitUntil es no-op fuera de Vercel; en dev el proceso es long-running
  // y el promise flotante completa igual.
  waitUntil(job)
}
