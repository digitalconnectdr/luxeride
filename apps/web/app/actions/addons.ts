'use server'
// ── Add-ons de pago genéricos — Server Actions ─────────────────────────────────
// Ver lib/billing/addons.ts para el diseño. Mismo patrón que
// toggleAffiliateNetworkAction (app/actions/affiliates.ts) pero parametrizado
// por addon_key en vez de un booleano fijo por feature.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { ADDON_KEYS, type AddonKey } from '@/lib/billing/addons'

type ActionResult = { success: boolean; error?: string }

function isAddonKey(value: string): value is AddonKey {
  return (ADDON_KEYS as readonly string[]).includes(value)
}

/** Super-admin: activar/desactivar manualmente un add-on para una empresa. */
export async function toggleCompanyAddonAction(
  companyId: string,
  addonKey: string,
  enabled: boolean,
): Promise<ActionResult> {
  await requireRole('super_admin')
  if (!isAddonKey(addonKey)) return { success: false, error: 'Add-on inválido' }

  const admin = createAdminClient()
  const { error } = await admin.from('company_addons').upsert(
    {
      company_id: companyId,
      addon_key: addonKey,
      enabled,
      enabled_at: enabled ? new Date().toISOString() : null,
      ...(enabled ? {} : { whop_membership_id: null }),
    },
    { onConflict: 'company_id,addon_key' },
  )

  if (error) return { success: false, error: error.message }
  revalidatePath(`/super-admin/companies/${companyId}`)
  return { success: true }
}
