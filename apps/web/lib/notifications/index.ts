// ── F1.14 — Notificaciones (Email vía Resend + SMS vía Twilio) ────────────────
// Server-only. Placeholder-safe: sin API keys reales, la notificación se registra
// en la tabla `notifications` con status 'pending' y no se envía nada.
//
// Flujo: notify() → busca template (empresa → default del sistema) → renderiza
// {{variables}} → respeta settings.notifications de la empresa → envía → registra.

import { waitUntil } from '@vercel/functions'
import { createAdminClient } from '@/lib/supabase/server'
import { brand } from '@/lib/brand'
import { notifyUserPush } from './push'
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

// ─── Notificaciones de plataforma (super-admin) ───────────────────────────────
// A diferencia de notify() (por-empresa, con templates), estos avisos van al
// dueño de la plataforma. Destinatarios: perfiles super_admin activos + la env
// SUPER_ADMIN_EMAIL (lista separada por comas) si está definida.

export async function getSuperAdminEmails(): Promise<string[]> {
  const emails = new Set<string>()
  const env = process.env.SUPER_ADMIN_EMAIL
  if (env) env.split(',').forEach((e) => { const t = e.trim(); if (t) emails.add(t) })

  try {
    const admin = createAdminClient()
    const { data: profiles } = await admin
      .from('user_profiles')
      .select('id')
      .eq('role', 'super_admin')
      .eq('is_active', true)
    for (const p of profiles ?? []) {
      try {
        const { data } = await admin.auth.admin.getUserById(p.id)
        if (data.user?.email) emails.add(data.user.email)
      } catch { /* usuario sin email accesible — se ignora */ }
    }
  } catch (err) {
    console.error('[getSuperAdminEmails]', err)
  }
  return [...emails]
}

/** Envía un email de plataforma a todos los super-admins. No lanza nunca. */
export async function sendSuperAdminEmail(subject: string, body: string): Promise<{ sent: number }> {
  const emails = await getSuperAdminEmails()
  let sent = 0
  for (const to of emails) {
    try {
      const r = await sendEmail(to, subject, body)
      if (r.ok) sent += 1
    } catch (err) {
      console.error('[sendSuperAdminEmail]', err)
    }
  }
  return { sent }
}

/** Versión no bloqueante (waitUntil) para usar en server actions con redirect. */
export function sendSuperAdminEmailInBackground(subject: string, body: string): void {
  waitUntil(sendSuperAdminEmail(subject, body).catch((err) => {
    console.error('[sendSuperAdminEmailInBackground]', err)
  }))
}

/**
 * Envía un email directo al operador (companies.email) sin pasar por el
 * sistema de templates — usado por alertas de Compliance Center donde el
 * contenido varía por empresa (motivos de bloqueo/alerta) y no amerita un
 * template editable. No lanza nunca; si la empresa no tiene email de
 * contacto, no envía nada.
 */
export async function sendOperatorEmail(companyId: string, subject: string, body: string): Promise<{ sent: boolean }> {
  try {
    const admin = createAdminClient()
    const { data: company } = await admin
      .from('companies')
      .select('email, name, logo_url, primary_color')
      .eq('id', companyId)
      .single()
    if (!company?.email) return { sent: false }
    const result = await sendEmail(company.email, subject, body, company.name, {
      logoUrl: company.logo_url,
      brandColor: company.primary_color,
    })
    return { sent: result.ok }
  } catch (err) {
    console.error('[sendOperatorEmail]', err)
    return { sent: false }
  }
}

// ─── Follow-up de cotizaciones (sin template; con dedup vía notifications) ─────
// Envía un email branded de seguimiento a una cotización abierta. Solo envía una
// vez por booking (chequea la tabla notifications por type 'quote_followup').

export async function sendQuoteFollowup(opts: {
  companyId: string
  bookingId: string
  to: string
  subject: string
  body: string
}): Promise<{ sent: boolean; skipped?: boolean }> {
  const admin = createAdminClient()

  // Dedup: ¿ya se envió un follow-up para esta cotización?
  const { data: existing } = await admin
    .from('notifications')
    .select('id')
    .eq('booking_id', opts.bookingId)
    .eq('type', 'quote_followup')
    .limit(1)
  if (existing && existing.length) return { sent: false, skipped: true }

  const { data: company } = await admin
    .from('companies')
    .select('name, logo_url, primary_color')
    .eq('id', opts.companyId)
    .single()

  const r = await sendEmail(opts.to, opts.subject, opts.body, company?.name, {
    logoUrl: (company as { logo_url?: string | null })?.logo_url ?? null,
    brandColor: (company as { primary_color?: string | null })?.primary_color ?? null,
  })

  await admin.from('notifications').insert({
    company_id: opts.companyId,
    booking_id: opts.bookingId,
    channel: 'email',
    type: 'quote_followup',
    recipient: opts.to,
    subject: opts.subject,
    body: opts.body,
    status: r.ok ? 'sent' : isResendConfigured() ? 'failed' : 'pending',
    sent_at: r.ok ? new Date().toISOString() : null,
    error_message: r.ok ? null : r.error ?? null,
  })

  return { sent: r.ok }
}

// ─── Recordatorios de viaje próximo (sin template; con dedup vía notifications) ─
// Umbrales configurables por el operador en MINUTOS (settings.
// notificationReminders, ver app/actions/settings.ts) — "avisar N minutos
// antes" al pasajero y/o al conductor, por email, SMS y/o push. El cron de
// apps/web/app/api/cron/booking-reminders/route.ts corre 1 vez al día vía
// Vercel (respaldo) pero está pensado para dispararse cada 5-15 min vía un
// schedule de Upstash QStash (mismo CRON_SECRET como header, sin tocar el
// plan de Vercel) — así el aviso sí puede llegar con precisión real de
// minutos. `type` incluye el umbral (ej. 'reminder_passenger_30m') y el
// dedup filtra también por `channel`, para que email, SMS y push del mismo
// umbral se puedan enviar de forma independiente sin pisarse entre sí.
// El push reusa EXACTAMENTE los mismos umbrales ya configurables por el
// operador — no hace falta una sección nueva en /admin/settings, es el
// mismo "cuándo" con un canal más.

export async function sendBookingReminder(opts: {
  companyId: string
  bookingId: string
  channel: 'email' | 'sms' | 'push'
  type: string
  /** Email, teléfono, o (para push) el user_id del destinatario. */
  to: string
  subject?: string // solo aplica a email
  body: string
}): Promise<{ sent: boolean; skipped?: boolean }> {
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('notifications')
    .select('id')
    .eq('booking_id', opts.bookingId)
    .eq('type', opts.type)
    .eq('channel', opts.channel)
    .limit(1)
  if (existing && existing.length) return { sent: false, skipped: true }

  // Push: si todavía no hay ningún dispositivo registrado para este usuario,
  // se omite SIN marcar el dedup como consumido — así, si instala la app y
  // registra un token más tarde (pero antes de que pase la hora del viaje),
  // la siguiente corrida del cron sí puede avisarle. Email/SMS no necesitan
  // este chequeo porque su "dirección" (email/teléfono) no cambia con el tiempo.
  if (opts.channel === 'push') {
    const { data: tokens } = await admin.from('device_tokens').select('expo_push_token').eq('user_id', opts.to)
    if (!tokens || !tokens.length) return { sent: false, skipped: true }
  }

  let result: { ok: boolean; providerId?: string; error?: string }
  if (opts.channel === 'email') {
    const { data: company } = await admin
      .from('companies')
      .select('name, logo_url, primary_color')
      .eq('id', opts.companyId)
      .single()
    result = await sendEmail(opts.to, opts.subject ?? brand.name, opts.body, company?.name, {
      logoUrl: (company as { logo_url?: string | null })?.logo_url ?? null,
      brandColor: (company as { primary_color?: string | null })?.primary_color ?? null,
    })
  } else if (opts.channel === 'sms') {
    result = await sendSms(opts.to, opts.body)
  } else {
    await notifyUserPush(opts.to, brand.name, opts.body, { bookingId: opts.bookingId, type: opts.type })
    result = { ok: true }
  }

  const configured = opts.channel === 'email' ? isResendConfigured() : opts.channel === 'sms' ? isTwilioConfigured() : true

  await admin.from('notifications').insert({
    company_id: opts.companyId,
    booking_id: opts.bookingId,
    channel: opts.channel,
    type: opts.type,
    recipient: opts.to,
    subject: opts.subject ?? null,
    body: opts.body,
    status: result.ok ? 'sent' : configured ? 'failed' : 'pending',
    provider_id: result.providerId ?? null,
    sent_at: result.ok ? new Date().toISOString() : null,
    error_message: result.ok ? null : result.error ?? null,
  })

  return { sent: result.ok }
}

// ─── Push de re-engagement (pasajeros inactivos) ──────────────────────────────
// A diferencia de sendBookingReminder (dedup por booking), este no tiene
// booking asociado — el dedup es por usuario, con un cooldown de 30 días
// (no queremos empujar el mismo aviso cada vez que corre el cron semanal
// mientras el pasajero sigue sin reservar). Reusa la tabla `notifications`
// con booking_id NULL y recipient = user_id, mismo patrón de auditoría.

export async function sendReengagementPush(opts: {
  companyId: string
  userId: string
  body: string
}): Promise<{ sent: boolean; skipped?: boolean }> {
  const admin = createAdminClient()

  const cooldownStart = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString()
  const { data: existing } = await admin
    .from('notifications')
    .select('id')
    .eq('recipient', opts.userId)
    .eq('type', 'reengagement')
    .eq('channel', 'push')
    .gte('created_at', cooldownStart)
    .limit(1)
  if (existing && existing.length) return { sent: false, skipped: true }

  const { data: tokens } = await admin.from('device_tokens').select('expo_push_token').eq('user_id', opts.userId)
  if (!tokens || !tokens.length) return { sent: false, skipped: true }

  await notifyUserPush(opts.userId, brand.name, opts.body, { type: 'reengagement' })

  await admin.from('notifications').insert({
    company_id: opts.companyId,
    channel: 'push',
    type: 'reengagement',
    recipient: opts.userId,
    body: opts.body,
    status: 'sent',
    sent_at: new Date().toISOString(),
  })

  return { sent: true }
}
