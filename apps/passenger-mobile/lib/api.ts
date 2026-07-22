// ── Llamadas a las rutas /api/mobile/passenger/* del servidor web ─────────
// Mismo patrón que apps/driver-mobile/lib/api.ts: rutas delgadas en el
// servidor que validan el bearer token y delegan a los mismos núcleos que
// ya usa el wizard público de la web (pricing engine, creación de reserva)
// — nada se duplica. `signup` es la única ruta sin sesión previa (la crea).

import { supabase } from './supabase'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!

export interface ApiResult {
  success: boolean
  error?: string
}

export async function callPassengerApi<T extends object = object>(
  path: string,
  body: Record<string, unknown>,
): Promise<ApiResult & T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  try {
    const res = await fetch(`${API_BASE_URL}/api/mobile/passenger/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify(body),
    })
    return (await res.json()) as ApiResult & T
  } catch {
    return { success: false, error: 'Error de conexión. Intenta de nuevo.' } as ApiResult & T
  }
}
