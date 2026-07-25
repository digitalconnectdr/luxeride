// ── App móvil del pasajero — centro de notificaciones ─────────────────────
// Lista los avisos del pasajero (30 días) + cuántos son nuevos desde la
// última vez que abrió la campana. POST sin body = listar; con
// { markSeen: true } = además marcar todo como visto (lo que hace la app al
// abrir la pantalla).
//
// Va por ruta de servidor y no por Supabase directo por consistencia con el
// resto de llamadas de la app: aunque passenger_notifications SÍ tiene RLS
// que permitiría leer directo, el conteo de no-leídos necesita cruzar dos
// tablas y el "marcar visto" es un upsert — resolverlo aquí deja un solo
// viaje de red en vez de tres.
import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HISTORY_DAYS = 30
const MAX_ITEMS = 50

export async function POST(request: Request) {
  const user = await getUserFromBearerToken(request.headers.get('authorization'))
  if (!user) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  if (user.role !== 'customer') {
    return NextResponse.json({ success: false, error: 'Solo pasajeros' }, { status: 403 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    // Sin body = solo listar. No es un error.
  }

  const admin = createAdminClient()
  const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString()

  const [{ data: rows }, { data: readRow }] = await Promise.all([
    admin
      .from('passenger_notifications')
      .select('id, type, title, body, booking_id, created_at')
      .eq('customer_id', user.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(MAX_ITEMS),
    admin
      .from('passenger_notification_reads')
      .select('last_seen_at')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const lastSeenAt = readRow?.last_seen_at ? new Date(readRow.last_seen_at).getTime() : 0
  const items = (rows ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    bookingId: n.booking_id,
    createdAt: n.created_at,
    isNew: new Date(n.created_at).getTime() > lastSeenAt,
  }))
  const unreadCount = items.filter((n) => n.isNew).length

  // El marcado va DESPUÉS de calcular isNew: si se marcara antes, el pasajero
  // abriría la pantalla y vería todo como ya leído, sin distinguir lo nuevo.
  if (body?.markSeen === true) {
    await admin
      .from('passenger_notification_reads')
      .upsert({ user_id: user.id, last_seen_at: new Date().toISOString() }, { onConflict: 'user_id' })
  }

  return NextResponse.json({ success: true, items, unreadCount })
}
