// ── App móvil del pasajero — preferencias de viaje ────────────────────────
// GET-por-POST sin body = leer; con { save: true, ... } = guardar.
// `passenger_preferences` tiene RLS propia por customer_id, pero se resuelve
// por ruta de servidor igual que el resto de la app: la lectura necesita
// además la lista de tipos de vehículo de la empresa (para el selector de
// vehículo preferido), y esa tabla sí está fuera del alcance del pasajero.
import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { createAdminClient } from '@/lib/supabase/server'
import { toPreferences, type PassengerPreferences } from '@/lib/passenger/preferences'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CONVERSATION = ['no_preference', 'quiet', 'chatty']
const TEMPERATURE = ['no_preference', 'cool', 'mild', 'warm']
const MUSIC = ['no_preference', 'none', 'soft', 'driver_choice']

export async function POST(request: Request) {
  const user = await getUserFromBearerToken(request.headers.get('authorization'))
  if (!user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  if (user.role !== 'customer') {
    return NextResponse.json({ success: false, error: 'Solo pasajeros' }, { status: 403 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    // Sin body = solo leer.
  }

  const admin = createAdminClient()

  if (body?.save === true) {
    // Se valida contra las listas permitidas en vez de confiar en el CHECK de
    // la BD: así el error es un 400 explicable y no un fallo de constraint.
    const conversation = String(body.conversation ?? 'no_preference')
    const temperature = String(body.temperature ?? 'no_preference')
    const music = String(body.music ?? 'no_preference')
    if (!CONVERSATION.includes(conversation) || !TEMPERATURE.includes(temperature) || !MUSIC.includes(music)) {
      return NextResponse.json({ success: false, error: 'Preferencia no válida' }, { status: 400 })
    }

    const standingNotes = typeof body.standingNotes === 'string' ? body.standingNotes.trim().slice(0, 500) : null
    const preferredVehicleTypeId =
      typeof body.preferredVehicleTypeId === 'string' && body.preferredVehicleTypeId ? body.preferredVehicleTypeId : null

    const { error } = await admin.from('passenger_preferences').upsert(
      {
        customer_id: user.id,
        conversation,
        temperature,
        music,
        luggage_help: Boolean(body.luggageHelp),
        standing_notes: standingNotes || null,
        preferred_vehicle_type_id: preferredVehicleTypeId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'customer_id' },
    )
    if (error) {
      console.error('[preferences:save]', error)
      return NextResponse.json({ success: false, error: 'No se pudo guardar' }, { status: 500 })
    }
  }

  const { data: row } = await admin
    .from('passenger_preferences')
    .select('conversation, temperature, music, luggage_help, standing_notes, preferred_vehicle_type_id')
    .eq('customer_id', user.id)
    .maybeSingle()

  // Tipos de vehículo de la empresa del pasajero, para el selector de
  // "vehículo preferido".
  const companySlug = typeof body.companySlug === 'string' ? body.companySlug : null
  let vehicleTypes: { id: string; name: string }[] = []
  if (companySlug) {
    const { data: company } = await admin.from('companies').select('id').eq('slug', companySlug).maybeSingle()
    if (company) {
      const { data: types } = await admin
        .from('vehicle_types')
        .select('id, name')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('sort_order')
      vehicleTypes = types ?? []
    }
  }

  const preferences: PassengerPreferences = toPreferences(row as Record<string, unknown> | null)
  return NextResponse.json({ success: true, preferences, vehicleTypes })
}
