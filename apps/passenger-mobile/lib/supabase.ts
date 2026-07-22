// ── Cliente Supabase para la app del pasajero ──────────────────────────────
// Misma base de datos que apps/web y apps/driver-mobile (misma RLS: un
// pasajero solo ve sus propias reservas vía `customers_select_own_bookings`,
// ya existente). No hay backend nuevo para lecturas — la app habla directo
// con Supabase (anon key + RLS), igual que el plan de docs/PHASE-2-MOBILE.md.

import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
