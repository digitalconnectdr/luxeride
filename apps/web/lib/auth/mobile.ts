// ── Auth para la app móvil del conductor (bearer token, sin cookies) ──────────
// Las Server Actions (session.ts) leen la sesión de las cookies de Next.js —
// eso no existe en una app nativa. La app móvil autentica directo contra
// Supabase Auth (supabase.auth.signInWithPassword) y manda el access_token
// resultante como `Authorization: Bearer <token>` en cada request a las rutas
// de /api/mobile/*. Esta función valida ese token y resuelve el mismo
// `SessionUser` que usan las Server Actions, para reusar la lógica existente.

import { createAdminClient } from '@/lib/supabase/server'
import type { SessionUser, UserProfile } from './session'
import type { UserRole } from './permissions'

export async function getUserFromBearerToken(authHeader: string | null): Promise<SessionUser | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) return null

  const admin = createAdminClient()

  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) return null

  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (profileError || !profile) return null

  const typedProfile = profile as unknown as UserProfile

  return {
    id: user.id,
    email: user.email!,
    role: typedProfile.role as UserRole,
    company_id: typedProfile.company_id,
    profile: typedProfile,
  }
}
