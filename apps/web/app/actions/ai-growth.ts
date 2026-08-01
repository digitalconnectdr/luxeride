'use server'
// ── AI Growth Assistant — Server Actions ───────────────────────────────────────
// Ver lib/billing/ai-growth-addon.ts (tiers/cuotas) y lib/ai-growth/context.ts
// (prompt de marketing). El seguimiento de cotizaciones con IA vive en
// app/api/cron/quote-followup/route.ts (automático); esta acción cubre el
// generador de contenido bajo demanda.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getLocale } from '@/lib/i18n/server'
import { checkRateLimit, RATE_LIMIT_ERROR } from '@/lib/security/rate-limit'
import { buildGrowthContentSystemPrompt } from '@/lib/ai-growth/context'
import { getChatCompletion, isOpenAiConfigured } from '@/lib/ai-chat/openai'
import { tierFromAiGrowthAddonKey, AI_GROWTH_TIER_QUOTA } from '@/lib/billing/ai-growth-addon'
import { getZonedIsoDate, isoDateStartOfMonth, zonedMidnightUtc } from '@/lib/time/zoned-bounds'

type ActionResult<T = undefined> = { success: boolean; error?: string; data?: T }

const MAX_PROMPT_LENGTH = 500

async function requireAiGrowthTier(admin: ReturnType<typeof createAdminClient>, companyId: string) {
  const { data: addons } = await admin
    .from('company_addons')
    .select('addon_key, enabled')
    .eq('company_id', companyId)
    .in('addon_key', ['ai_growth_basic', 'ai_growth_plus'])
  const active = (addons ?? []).find((a) => a.enabled)
  return active ? tierFromAiGrowthAddonKey(active.addon_key) : null
}

export async function generateGrowthContentAction(prompt: string): Promise<ActionResult<{ text: string }>> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const trimmed = prompt.trim()
  if (!trimmed) return { success: false, error: 'Escribe qué contenido necesitas.' }
  if (trimmed.length > MAX_PROMPT_LENGTH) return { success: false, error: 'El texto es demasiado largo.' }

  const allowed = await checkRateLimit('ai_growth_content', 10, 60_000)
  if (!allowed) return { success: false, error: RATE_LIMIT_ERROR }

  if (!isOpenAiConfigured()) {
    return { success: false, error: 'El generador de contenido no está disponible en este momento.' }
  }

  const admin = createAdminClient()
  const tier = await requireAiGrowthTier(admin, user.company_id)
  if (!tier) return { success: false, error: 'El AI Growth Assistant no está activo para tu empresa.' }

  const locale = getLocale()
  const systemPrompt = await buildGrowthContentSystemPrompt({ admin, companyId: user.company_id, locale })
  if (!systemPrompt) return { success: false, error: 'Empresa no encontrada.' }

  const completion = await getChatCompletion(systemPrompt, [{ role: 'user', content: trimmed }])
  if (!completion.success) return { success: false, error: completion.error }

  await admin.from('ai_growth_generations').insert({ company_id: user.company_id, type: 'content' })
  revalidatePath('/admin/growth-assistant')

  return { success: true, data: { text: completion.reply } }
}

export async function getAiGrowthUsageAction(): Promise<ActionResult<{ tier: string; used: number; quota: number }>> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const tier = await requireAiGrowthTier(admin, user.company_id)
  if (!tier) return { success: false, error: 'not_active' }

  // Límite en la zona horaria de la EMPRESA, no en UTC del servidor (mismo
  // criterio que /admin/assistant y /admin/growth-assistant).
  const { data: company } = await admin.from('companies').select('timezone').eq('id', user.company_id).single()
  const monthStartIso = isoDateStartOfMonth(getZonedIsoDate(new Date(), company?.timezone))
  const { count } = await admin
    .from('ai_growth_generations')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', user.company_id)
    .gte('created_at', zonedMidnightUtc(monthStartIso, company?.timezone).toISOString())

  return { success: true, data: { tier, used: count ?? 0, quota: AI_GROWTH_TIER_QUOTA[tier] } }
}
