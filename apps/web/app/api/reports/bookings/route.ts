// ── F1.15 — Export CSV de reservaciones ───────────────────────────────────────
// Auth: roles financieros. company_id SIEMPRE de la sesión del servidor.

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getDict } from '@/lib/i18n/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user || !['company_owner', 'company_admin', 'accounting'].includes(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!user.company_id) {
    return NextResponse.json({ error: 'No company' }, { status: 400 })
  }

  const url = new URL(request.url)
  const fromStr = url.searchParams.get('from')
  const toStr = url.searchParams.get('to')

  const from = fromStr ? new Date(fromStr) : new Date(new Date().setDate(1))
  const to = toStr ? new Date(toStr) : new Date()
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
  }
  to.setHours(23, 59, 59, 999)

  const admin = createAdminClient()
  const { data: bookings, error } = await admin
    .from('bookings')
    .select('booking_number, status, type, passenger_name, passenger_phone, passenger_email, scheduled_at, completed_at, pickup_location, dropoff_location, distance_miles, duration_minutes, base_amount, total_amount, currency, created_at')
    .eq('company_id', user.company_id)
    .gte('scheduled_at', from.toISOString())
    .lte('scheduled_at', to.toISOString())
    .order('scheduled_at')
    .limit(5000)

  if (error) {
    console.error('[reports/bookings.csv]', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  // Encabezados y estados según el idioma activo (cookie luxeride_locale)
  const dict = getDict()
  const c = dict.admin.reportsCsv
  const statusLabels = dict.adminDashboard.statuses as Record<string, string>

  const header = [
    c.bookingNumber, c.status, c.type, c.passengerName, c.passengerPhone,
    c.passengerEmail, c.scheduledAt, c.completedAt, c.pickupAddress,
    c.dropoffAddress, c.distanceMiles, c.durationMinutes, c.baseAmount,
    c.totalAmount, c.currency, c.createdAt,
  ]

  const rows = (bookings ?? []).map((b) => [
    b.booking_number, statusLabels[b.status] ?? b.status, b.type, b.passenger_name, b.passenger_phone,
    b.passenger_email, b.scheduled_at, b.completed_at,
    (b.pickup_location as { address?: string } | null)?.address ?? '',
    (b.dropoff_location as { address?: string } | null)?.address ?? '',
    b.distance_miles, b.duration_minutes, b.base_amount, b.total_amount,
    b.currency, b.created_at,
  ].map(csvEscape).join(','))

  const csv = [header.join(','), ...rows].join('\r\n')
  const filename = `bookings_${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}.csv`

  return new NextResponse('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
