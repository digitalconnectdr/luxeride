// ── Historial de viajes — placeholder ──────────────────────────────────────
// Sprint 4 (ver docs/PHASE-2-MOBILE.md): ya existe todo lo necesario en el
// backend (RLS customers_select_own_bookings) — solo falta la UI nativa.

import { View } from 'react-native'
import { EmptyState } from '../components/ui'
import { color } from '../lib/theme'

export function MyTripsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: color.bg, justifyContent: 'center' }}>
      <EmptyState
        icon="time-outline"
        title="Historial de viajes"
        subtitle="Muy pronto verás aquí tus reservas pasadas y podrás re-reservar en un toque."
      />
    </View>
  )
}
