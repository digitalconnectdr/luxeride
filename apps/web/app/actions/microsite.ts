'use server'
// ── Microsite del operador: portada (tagline/hero/about) + servicios ──────────
// SECURITY: solo company_owner / company_admin. company_id del servidor.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import type { Json } from '@/lib/supabase/database.types'

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export type SiteResult = { success: boolean; error?: string }

// ─── Portada: slogan, imagen hero, "sobre nosotros" ───────────────────────────

export async function updateSiteAction(
  _prev: SiteResult | null,
  formData: FormData,
): Promise<SiteResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const tagline = ((formData.get('tagline') as string) ?? '').trim().slice(0, 140) || null
  const about = ((formData.get('about') as string) ?? '').trim().slice(0, 2000) || null
  const whatsapp = ((formData.get('whatsapp') as string) ?? '').trim().slice(0, 30) || null
  const googlePlaceId = ((formData.get('google_place_id') as string) ?? '').trim().slice(0, 120) || null
  // Plantilla del micrositio (white-label: cada empresa elige su diseño).
  const templateRaw = (formData.get('template') as string) ?? 'noir'
  const template = ['noir', 'ivory', 'bold', 'corporate'].includes(templateRaw) ? templateRaw : 'noir'
  const hero = formData.get('hero_image') as File | null
  const removeHero = formData.get('remove_hero') === 'true'

  const admin = createAdminClient()

  // Merge en settings.site (whatsapp + google place id)
  const { data: current } = await admin.from('companies').select('settings').eq('id', user.company_id).single()
  const settings = (current?.settings as Record<string, unknown>) ?? {}
  const site = (settings.site as Record<string, unknown>) ?? {}
  const mergedSettings = { ...settings, site: { ...site, whatsapp, googlePlaceId, template } }

  const updates: { tagline: string | null; about: string | null; hero_image_url?: string | null; settings: Json } = {
    tagline,
    about,
    settings: mergedSettings as Json,
  }

  if (removeHero) {
    updates.hero_image_url = null
  } else if (hero && hero.size > 0) {
    if (hero.size > 5_000_000) return { success: false, error: 'La imagen no puede superar 5 MB.' }
    const ext = MIME_EXT[hero.type]
    if (!ext) return { success: false, error: 'Formato no válido. Usa PNG, JPG o WebP.' }
    const path = `${user.company_id}/hero.${ext}`
    const buffer = Buffer.from(await hero.arrayBuffer())
    const { error: upErr } = await admin.storage
      .from('branding')
      .upload(path, buffer, { contentType: hero.type, upsert: true })
    if (upErr) {
      console.error('[updateSiteAction] hero upload', upErr)
      return { success: false, error: 'Error al subir la imagen.' }
    }
    const { data: pub } = admin.storage.from('branding').getPublicUrl(path)
    updates.hero_image_url = `${pub.publicUrl}?v=${Date.now()}`
  }

  const { error } = await admin.from('companies').update(updates).eq('id', user.company_id)
  if (error) {
    console.error('[updateSiteAction]', error)
    return { success: false, error: 'Error al guardar la portada.' }
  }

  revalidatePath('/admin/settings')
  revalidatePath('/book', 'layout')
  return { success: true }
}

// ─── Servicios del operador (company_services) ────────────────────────────────

export async function createServiceAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const title = ((formData.get('title') as string) ?? '').trim().slice(0, 80)
  const description = ((formData.get('description') as string) ?? '').trim().slice(0, 280) || null
  const icon = ((formData.get('icon') as string) ?? '').trim().slice(0, 8) || null

  if (!title) return { success: false, error: 'Título requerido' }

  const admin = createAdminClient()
  const { error } = await admin.from('company_services').insert({
    company_id: user.company_id,
    title,
    description,
    icon,
  })
  if (error) {
    console.error('[createServiceAction]', error)
    return { success: false, error: 'Error al crear el servicio' }
  }

  revalidatePath('/admin/settings')
  revalidatePath('/book', 'layout')
  return { success: true }
}

export async function updateServiceAction(
  serviceId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const title = ((formData.get('title') as string) ?? '').trim().slice(0, 80)
  const description = ((formData.get('description') as string) ?? '').trim().slice(0, 280) || null
  const icon = ((formData.get('icon') as string) ?? '').trim().slice(0, 8) || null

  if (!title) return { success: false, error: 'Título requerido' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('company_services')
    .update({ title, description, icon })
    .eq('id', serviceId)
    .eq('company_id', user.company_id)
  if (error) {
    console.error('[updateServiceAction]', error)
    return { success: false, error: 'Error al actualizar el servicio' }
  }

  revalidatePath('/admin/settings')
  revalidatePath('/book', 'layout')
  return { success: true }
}

export async function toggleServiceActiveAction(
  serviceId: string,
  isActive: boolean,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('company_services')
    .update({ is_active: isActive })
    .eq('id', serviceId)
    .eq('company_id', user.company_id)
  if (error) return { success: false, error: 'Error al actualizar estado' }

  revalidatePath('/admin/settings')
  revalidatePath('/book', 'layout')
  return { success: true }
}

export async function deleteServiceAction(
  serviceId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('company_services')
    .delete()
    .eq('id', serviceId)
    .eq('company_id', user.company_id)
  if (error) return { success: false, error: 'Error al eliminar el servicio' }

  revalidatePath('/admin/settings')
  revalidatePath('/book', 'layout')
  return { success: true }
}
