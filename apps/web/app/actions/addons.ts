'use server'
// ── Add-ons de pago genéricos — Server Actions ─────────────────────────────────
// Ver lib/billing/addons.ts para el diseño. Mismo patrón que
// toggleAffiliateNetworkAction (app/actions/affiliates.ts) pero parametrizado
// por addon_key en vez de un booleano fijo por feature.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { ADDON_KEYS, type AddonKey } from '@/lib/billing/addons'
import { isAiChatAddonKey } from '@/lib/billing/ai-chat-addon'

type ActionResult = { success: boolean; error?: string }

function isAddonKey(value: string): value is AddonKey {
  return (ADDON_KEYS as readonly string[]).includes(value)
}

/**
 * Super-admin: activar/desactivar manualmente un add-on para una empresa.
 * También acepta los tiers del Asistente de IA (ai_chat_basic/ai_chat_plus,
 * ver lib/billing/ai-chat-addon.ts) — no son un AddonKey a propósito (no se
 * incluyen gratis en Elite/Enterprise), pero comparten la misma tabla
 * `company_addons` y el mismo componente de toggle, así que se validan aquí
 * también. Al activar uno de los dos tiers, se apaga el otro (mutuamente
 * excluyentes: una empresa solo puede tener un tier del asistente a la vez).
 */
export async function toggleCompanyAddonAction(
  companyId: string,
  addonKey: string,
  enabled: boolean,
): Promise<ActionResult> {
  await requireRole('super_admin')
  if (!isAddonKey(addonKey) && !isAiChatAddonKey(addonKey)) {
    return { success: false, error: 'Add-on inválido' }
  }

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

  if (enabled && isAiChatAddonKey(addonKey)) {
    const otherTierKey = addonKey === 'ai_chat_basic' ? 'ai_chat_plus' : 'ai_chat_basic'
    await admin
      .from('company_addons')
      .update({ enabled: false, whop_membership_id: null })
      .eq('company_id', companyId)
      .eq('addon_key', otherTierKey)
  }

  revalidatePath(`/super-admin/companies/${companyId}`)
  return { success: true }
}
