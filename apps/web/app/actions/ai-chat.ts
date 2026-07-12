'use server'
// ── Asistente de IA del micrositio — Server Action ─────────────────────────────
// Ver lib/ai-chat/context.ts para el porque del aislamiento por empresa y
// lib/billing/ai-chat-addon.ts para tiers/cuotas. La cuota mensual es
// INFORMATIVA (para que el operador vea su consumo en /admin/assistant y se
// facture el excedente aparte) - nunca bloquea al visitante a mitad de una
// conversación, eso perjudicaría al negocio del operador más de lo que cuesta
// el excedente real.

import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { getLocale } from '@/lib/i18n/server'
import { checkRateLimit, RATE_LIMIT_ERROR } from '@/lib/security/rate-limit'
import { buildCompanySystemPrompt } from '@/lib/ai-chat/context'
import { getChatCompletion, isOpenAiConfigured, type ChatTurn } from '@/lib/ai-chat/openai'

const MAX_MESSAGE_LENGTH = 800
const MAX_MESSAGES_PER_CONVERSATION = 30 // 15 turnos usuario/asistente
const RATE_LIMIT_PER_MINUTE = 15

type SendResult =
  | { success: true; sessionToken: string; reply: string }
  | { success: false; error: string }

export async function sendChatWidgetMessageAction(
  companySlug: string,
  sessionToken: string | null,
  message: string,
): Promise<SendResult> {
  const trimmed = message.trim()
  if (!trimmed) return { success: false, error: 'Escribe un mensaje.' }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { success: false, error: 'Tu mensaje es demasiado largo.' }
  }

  const allowed = await checkRateLimit('ai_chat_widget', RATE_LIMIT_PER_MINUTE, 60_000)
  if (!allowed) return { success: false, error: RATE_LIMIT_ERROR }

  if (!isOpenAiConfigured()) {
    return { success: false, error: 'El asistente no está disponible en este momento.' }
  }

  const admin = createAdminClient()

  const { data: company } = await admin
    .from('companies')
    .select('id')
    .eq('slug', companySlug)
    .maybeSingle()
  if (!company) return { success: false, error: 'Empresa no encontrada.' }

  // ¿Tiene el add-on activo? (basic o plus — mutuamente excluyentes en la práctica)
  const { data: addons } = await admin
    .from('company_addons')
    .select('addon_key, enabled')
    .eq('company_id', company.id)
    .in('addon_key', ['ai_chat_basic', 'ai_chat_plus'])
  const active = (addons ?? []).find((a) => a.enabled)
  if (!active) return { success: false, error: 'El asistente no está activo para esta empresa.' }

  // ── Conversación: recupera la existente (validando que sea de ESTA empresa,
  // nunca confiar en un session_token de otro tenant) o crea una nueva ────────
  let conversationId: string | null = null
  let currentToken = sessionToken

  if (currentToken) {
    const { data: existing } = await admin
      .from('ai_chat_conversations')
      .select('id, company_id')
      .eq('session_token', currentToken)
      .maybeSingle()
    if (existing && existing.company_id === company.id) {
      conversationId = existing.id
    } else {
      currentToken = null
    }
  }

  if (!currentToken) {
    currentToken = randomUUID()
    const { data: created, error } = await admin
      .from('ai_chat_conversations')
      .insert({ company_id: company.id, session_token: currentToken })
      .select('id')
      .single()
    if (error || !created) {
      console.error('[ai-chat] no se pudo crear la conversación', error)
      return { success: false, error: 'No se pudo iniciar la conversación.' }
    }
    conversationId = created.id
  }

  if (!conversationId) {
    return { success: false, error: 'No se pudo iniciar la conversación.' }
  }

  const { data: priorMessages, count } = await admin
    .from('ai_chat_messages')
    .select('role, content', { count: 'exact' })
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if ((count ?? 0) >= MAX_MESSAGES_PER_CONVERSATION) {
    return {
      success: true,
      sessionToken: currentToken,
      reply: 'Esta conversación llegó a su límite. Por favor contáctanos directamente o usa el formulario de reserva para continuar.',
    }
  }

  const locale = getLocale()
  const systemPrompt = await buildCompanySystemPrompt({ admin, companyId: company.id, locale })
  if (!systemPrompt) return { success: false, error: 'Empresa no encontrada.' }

  const history: ChatTurn[] = [
    ...(priorMessages ?? []).map((m) => ({ role: m.role as ChatTurn['role'], content: m.content })),
    { role: 'user', content: trimmed },
  ]

  const completion = await getChatCompletion(systemPrompt, history)

  await admin.from('ai_chat_messages').insert({ conversation_id: conversationId, role: 'user', content: trimmed })

  if (!completion.success) {
    return { success: false, error: completion.error }
  }

  await Promise.all([
    admin.from('ai_chat_messages').insert({ conversation_id: conversationId, role: 'assistant', content: completion.reply }),
    admin.from('ai_chat_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId),
  ])

  return { success: true, sessionToken: currentToken, reply: completion.reply }
}
