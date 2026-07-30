import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getDict } from '@/lib/i18n/server'

export function generateMetadata(): Metadata {
  return { title: getDict().corporate.book.pageTitle }
}

// Redirige al booking flow público de la empresa del usuario corporativo.
// Las reservaciones corporativas con cargo a cuenta se gestionan vía dispatcher;
// el flujo self-service usa el wizard público de la empresa.
export default async function CorporateBookPage() {
  const user = await requireRole('corporate_manager', 'corporate_user')

  if (!user.company_id) redirect('/corporate/dashboard')

  const admin = createAdminClient()
  const { data: company } = await admin
    .from('companies')
    .select('slug, status')
    .eq('id', user.company_id)
    .single()

  if (!company || company.status !== 'active') redirect('/corporate/dashboard')

  redirect(`/book/${company.slug}`)
}
