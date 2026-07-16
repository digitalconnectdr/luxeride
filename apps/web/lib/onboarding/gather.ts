import type { createAdminClient } from '@/lib/supabase/server'
import type { OnboardingCounts } from './checklist'

type Admin = ReturnType<typeof createAdminClient>

// ── Reúne los conteos de setup de una empresa ──────────────────────────────────
// Todo vía count:'exact', head:true — no viajan filas, solo el número.
export async function gatherOnboardingCounts(
  admin: Admin,
  companyId: string
): Promise<OnboardingCounts> {
  const [
    { count: vehicleTypesCount },
    { count: vehiclesCount },
    { count: serviceZonesCount },
    { count: pricingRulesCount },
    { count: teamOrDriversCount },
    { count: companyServicesCount },
    { data: company },
  ] = await Promise.all([
    admin.from('vehicle_types').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    admin.from('vehicles').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    admin.from('service_zones').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    admin.from('pricing_rules').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    admin.from('drivers').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    admin.from('company_services').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    admin
      .from('companies')
      .select('logo_url, primary_color, whop_connect_onboarded')
      .eq('id', companyId)
      .single(),
  ])

  return {
    vehicleTypesCount: vehicleTypesCount ?? 0,
    vehiclesCount: vehiclesCount ?? 0,
    serviceZonesCount: serviceZonesCount ?? 0,
    pricingRulesCount: pricingRulesCount ?? 0,
    // El sistema de cobros de LuxeRide es Whop (Whop Connect), no Stripe —
    // stripe_connect_onboarded solo puede ser true con una key real de
    // Stripe configurada, que hoy es un placeholder no funcional.
    paymentProviderConnected: Boolean(company?.whop_connect_onboarded),
    teamOrDriversCount: teamOrDriversCount ?? 0,
    hasLogo: Boolean(company?.logo_url),
    hasBrandColor: Boolean(company?.primary_color),
    companyServicesCount: companyServicesCount ?? 0,
  }
}
