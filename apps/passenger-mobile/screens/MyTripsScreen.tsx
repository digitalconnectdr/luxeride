// ── Historial de viajes del pasajero ────────────────────────────────────────
// Lee bookings directo por Supabase (RLS customers_select_own_bookings, ya
// existente) — antes esta pantalla era un placeholder fijo: si el pasajero
// cerraba la pantalla de "Reserva confirmada" sin tocar "Ver mi viaje", no
// tenía ninguna forma de volver a encontrar esa reserva. Tap en un viaje
// activo navega a TripTracking, que vive en el stack de la pestaña
// "Reservar" (navegación cross-tab: navigation.navigate('Reservar', { screen, params })).

import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { Card, EmptyState, ScreenLoader, StatusBadge } from '../components/ui'
import { PressableScale } from '../components/PressableScale'
import { color, font, space } from '../lib/theme'
import type { BookingStatus } from '../lib/types'

interface TripRow {
  id: string
  booking_number: string
  status: BookingStatus
  scheduled_at: string
  total_amount: number | null
  currency: string | null
  pickup_location: { address?: string } | null
  dropoff_location: { address?: string } | null
}

const ACTIVE_STATUSES: BookingStatus[] = ['pending', 'assigned', 'en_route', 'arrived', 'in_progress']

// Indicador de cercanía: mientras más cerca el viaje, más "urgente" el color
// (verde -> ámbar -> rojo), igual que el semáforo de StatusBadge pero para
// el tiempo restante en vez del estado.
function urgency(hoursUntil: number): { label: string; tint: string } {
  if (hoursUntil < 6) return { label: 'Muy pronto', tint: color.danger }
  if (hoursUntil < 24) return { label: 'Hoy', tint: color.warning }
  const days = Math.round(hoursUntil / 24)
  return { label: days <= 1 ? 'Mañana' : `En ${days} días`, tint: color.success }
}

export function MyTripsScreen() {
  // any: esta pantalla vive en el Tab.Navigator raíz, no en BookingStack
  // (que es donde vive TripTracking) — React Navigation soporta navegar a un
  // screen anidado de otra pestaña, pero no hay un tipo compartido para eso.
  const navigation = useNavigation<any>()
  const [trips, setTrips] = useState<TripRow[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('bookings')
      .select('id, booking_number, status, scheduled_at, total_amount, currency, pickup_location, dropoff_location')
      .order('scheduled_at', { ascending: false })
      .limit(30)

    if (loadError) {
      setError('No pudimos cargar tus viajes')
      return
    }
    setError('')
    setTrips((data ?? []) as unknown as TripRow[])
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  if (!trips && !error) return <ScreenLoader />

  if (error) {
    return (
      <View style={styles.container}>
        <EmptyState icon="alert-circle-outline" title="No se pudo cargar" subtitle={error} />
      </View>
    )
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      data={trips}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.gold} />}
      ListEmptyComponent={
        <EmptyState
          icon="time-outline"
          title="Historial de viajes"
          subtitle="Aún no tienes reservas. Cuando reserves un viaje, lo verás aquí."
        />
      }
      renderItem={({ item }) => {
        const isActive = ACTIVE_STATUSES.includes(item.status)
        const date = new Date(item.scheduled_at)
        const hoursUntil = (date.getTime() - Date.now()) / 3_600_000
        const showUrgency = isActive && hoursUntil > 0 && hoursUntil < 240 // hasta 10 días
        const urgencyInfo = showUrgency ? urgency(hoursUntil) : null
        return (
          <PressableScale
            onPress={() =>
              navigation.navigate('Reservar', { screen: 'TripTracking', params: { bookingId: item.id } })
            }
          >
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.number}>{item.booking_number}</Text>
                <StatusBadge status={item.status} />
              </View>

              <View style={styles.addressRow}>
                <View style={[styles.dot, { backgroundColor: color.gold }]} />
                <Text style={styles.address} numberOfLines={1}>
                  {item.pickup_location?.address ?? 'Origen'}
                </Text>
              </View>
              <View style={styles.addressRow}>
                <View style={[styles.dot, { backgroundColor: color.danger }]} />
                <Text style={styles.address} numberOfLines={1}>
                  {item.dropoff_location?.address ?? 'Destino'}
                </Text>
              </View>

              <View style={styles.footer}>
                <View style={styles.dateGroup}>
                  <Text style={styles.date}>
                    {date.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })} ·{' '}
                    {date.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {urgencyInfo && (
                    <View style={[styles.urgencyPill, { backgroundColor: `${urgencyInfo.tint}18`, borderColor: `${urgencyInfo.tint}40` }]}>
                      <View style={[styles.urgencyDot, { backgroundColor: urgencyInfo.tint }]} />
                      <Text style={[styles.urgencyText, { color: urgencyInfo.tint }]}>{urgencyInfo.label}</Text>
                    </View>
                  )}
                </View>
                {item.total_amount != null && (
                  <Text style={styles.price}>
                    ${item.total_amount.toFixed(0)} {item.currency ?? 'USD'}
                  </Text>
                )}
              </View>

              {isActive && (
                <View style={styles.activeHint}>
                  <Ionicons name="navigate-outline" size={13} color={color.gold} />
                  <Text style={styles.activeHintText}>Toca para ver el viaje en vivo</Text>
                </View>
              )}
            </Card>
          </PressableScale>
        )
      }}
    />
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  list: { padding: space.lg, gap: space.md },
  card: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  number: { color: color.ink, fontFamily: font.bodyBold, fontSize: 14 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  address: { flex: 1, color: color.inkFaint, fontFamily: font.body, fontSize: 13 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.xs,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  dateGroup: { gap: 4, flexShrink: 1 },
  date: { color: color.inkFaint, fontFamily: font.bodyMedium, fontSize: 12 },
  urgencyPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  urgencyDot: { width: 5, height: 5, borderRadius: 2.5 },
  urgencyText: { fontFamily: font.bodySemi, fontSize: 10 },
  price: { color: color.ink, fontFamily: font.displaySemi, fontSize: 16 },
  activeHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  activeHintText: { color: color.gold, fontFamily: font.bodyMedium, fontSize: 11 },
})
