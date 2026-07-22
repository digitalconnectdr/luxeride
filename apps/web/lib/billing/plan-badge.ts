// ── Etiqueta + color del plan de la empresa, para mostrar de un vistazo qué
// plan tiene el cliente (topbar admin). Colores ascendentes por prestigio.

import type { CompanyPlan } from '@/lib/supabase/database.types'

export const PLAN_LABEL: Record<CompanyPlan, string> = {
  free: 'Free',
  starter: 'Starter',
  professional: 'Professional',
  elite: 'Elite',
  enterprise: 'Enterprise',
}

export const PLAN_BADGE_STYLE: Record<CompanyPlan, string> = {
  free: 'bg-gray-100 text-gray-600 border-gray-200',
  starter: 'bg-blue-50 text-blue-700 border-blue-200',
  professional: 'bg-amber-50 text-amber-700 border-amber-200',
  elite: 'bg-purple-50 text-purple-700 border-purple-200',
  enterprise: 'bg-[#1a1613] text-gold border-[#1a1613]',
}
