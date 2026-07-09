// ── Llamadas a las rutas /api/mobile/driver/* del servidor web ────────────────
// Solo para las mutaciones que necesitan service-role (no hay policy RLS de
// UPDATE para el rol driver sobre bookings/payments). Las lecturas van
// directo a Supabase (ver lib/supabase.ts) — no pasan por aquí.

import { supabase } from './supabase'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!

export interface ApiResult {
  success: boolean
  error?: string
}

export async function callDriverApi(path: string, body: Record<string, unknown>): Promise<ApiResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  try {
    const res = await fetch(`${API_BASE_URL}/api/mobile/driver/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify(body),
    })
    return (await res.json()) as ApiResult
  } catch {
    return { success: false, error: 'Error de conexión. Intenta de nuevo.' }
  }
}
