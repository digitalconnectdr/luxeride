'use server'
// ── Reporte de rutas frecuentes — Server Action ────────────────────────────
// Solo lectura/agregación (no consume la cuota de ai_growth_generations,
// que es exclusiva de llamadas a OpenAI). Gating idéntico al del generador
// de contenido: mismo query inline a company_addons que ya usa
// requireAiGrowthTier en app/actions/ai-growth.ts (el patrón de este
// codebase es duplicar este chequeo pequeño por addon, no compartirlo).

import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { tierFromAiGrowthAddonKey } from '@/lib/billing/ai-growth-addon'
import { aggregateRoutes, type RouteInsightBooking, type RouteInsightsResult } from '@/lib/route-insights/engine'

type ActionResult<T = undefined> = { success: boolean; error?: string; data?: T }

const EXCLUDED_STATUSES = ['cancelled', 'no_show']

export interface RouteInsightsFilters {
  fromDate?: string
  toDate?: string
  vehicleTypeId?: string
}

export interface RouteInsightsData extends RouteInsightsResult {
  vehicleTypes: { id: string; name: string }[]
}

async function requireAiGrowthTier(admin: ReturnType<typeof createAdminClient>, companyId: string) {
  const { data: addons } = await admin
    .from('company_addons')
    .select('addon_key, enabled')
    .eq('company_id', companyId)
    .in('addon_key', ['ai_growth_basic', 'ai_growth_plus'])
  const active = (addons ?? []).find((a) => a.enabled)
  return active ? tierFromAiGrowthAddonKey(active.addon_key) : null
}

interface LocationJson {
  lat?: number
  lng?: number
}

export async function getRouteInsightsAction(
  filters: RouteInsightsFilters = {},
): Promise<ActionResult<RouteInsightsData>> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const tier = await requireAiGrowthTier(admin, user.company_id)
  if (!tier) return { success: false, error: 'not_active' }

  let query = admin
    .from('bookings')
    .select('pickup_city, pickup_country, pickup_location, dropoff_city, dropoff_country, dropoff_location, total_amount, status, booking_source')
    .eq('company_id', user.company_id)
    .not('status', 'in', `(${EXCLUDED_STATUSES.join(',')})`)

  if (filters.fromDate) query = query.gte('scheduled_at', filters.fromDate)
  if (filters.toDate) query = query.lte('scheduled_at', filters.toDate)
  if (filters.vehicleTypeId) query = query.eq('vehicle_type_id', filters.vehicleTypeId)

  const [{ data: bookings, error }, { data: vehicleTypes }] = await Promise.all([
    query,
    admin.from('vehicle_types').select('id, name').eq('company_id', user.company_id).eq('is_active', true).order('sort_order'),
  ])

  if (error) {
    console.error('[getRouteInsightsAction]', error)
    return { success: false, error: 'No se pudo cargar el reporte' }
  }

  const rows: RouteInsightBooking[] = (bookings ?? []).map((b) => {
    const pickup = b.pickup_location as LocationJson | null
    const dropoff = b.dropoff_location as LocationJson | null
    return {
      pickupCity: b.pickup_city,
      pickupCountry: b.pickup_country,
      pickupLat: pickup?.lat ?? null,
      pickupLng: pickup?.lng ?? null,
      dropoffCity: b.dropoff_city,
      dropoffCountry: b.dropoff_country,
      dropoffLat: dropoff?.lat ?? null,
      dropoffLng: dropoff?.lng ?? null,
      totalAmount: b.total_amount,
      bookingSource: b.booking_source,
    }
  })

  return {
    success: true,
    data: { ...aggregateRoutes(rows), vehicleTypes: vehicleTypes ?? [] },
  }
}
