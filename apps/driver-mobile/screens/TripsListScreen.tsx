import { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, RefreshControl, ScrollView } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { supabase } from '../lib/supabase'
import { ACTIVE_STATUSES, STATUS_LABEL, type DriverBooking, type TripsStackParamList } from '../lib/types'

type Props = NativeStackScreenProps<TripsStackParamList, 'TripsList'>

const BOOKING_COLUMNS =
  'id, booking_number, status, passenger_name, passenger_phone, scheduled_at, pickup_location, dropoff_location, flight_number, flight_status, flight_delay_minutes, total_amount, currency, completed_at'

function countdownLabel(scheduledAt: string): string {
  const diffMs = new Date(scheduledAt).getTime() - Date.now()
  if (diffMs <= 0) return 'Ahora'
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 60) return `En ${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `En ${hours}h ${rest}min`
}

function flightChip(trip: DriverBooking): string | null {
  if (!trip.flight_number) return null
  if (trip.flight_status === 'cancelled') return `✈ ${trip.flight_number} · Cancelado`
  if ((trip.flight_delay_minutes ?? 0) >= 15) return `✈ ${trip.flight_number} · +${trip.flight_delay_minutes} min`
  if (trip.flight_status === 'arrived') return `✈ ${trip.flight_number} · Aterrizó`
  if (trip.flight_status === 'enroute') return `✈ ${trip.flight_number} · En vuelo`
  return `✈ ${trip.flight_number}`
}

export function TripsListScreen({ navigation }: Props) {
  const [trips, setTrips] = useState<DriverBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [, setTick] = useState(0)

  const loadTrips = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('bookings')
      .select(BOOKING_COLUMNS)
      .eq('driver_id', user.id)
      .in('status', ACTIVE_STATUSES)
      .order('scheduled_at', { ascending: true })

    setTrips((data as DriverBooking[] | null) ?? [])
    setLoading(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadTrips()
    }, [loadTrips]),
  )

  // Refresca el "en X min" cada 30s sin volver a golpear la red.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#e9c176" />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={loadTrips} tintColor="#e9c176" />}
    >
      {trips.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No tienes viajes activos ahora mismo.</Text>
        </View>
      ) : (
        trips.map((trip, i) => {
          const chip = flightChip(trip)
          return (
            <Pressable
              key={trip.id}
              style={[styles.card, i === 0 && styles.cardNext]}
              onPress={() => navigation.navigate('TripDetail', { tripId: trip.id })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.bookingNumber}>{trip.booking_number}</Text>
                {i === 0 && <Text style={styles.nextBadge}>PRÓXIMO · {countdownLabel(trip.scheduled_at)}</Text>}
              </View>
              <Text style={styles.statusLabel}>{STATUS_LABEL[trip.status] ?? trip.status}</Text>
              <Text style={styles.passenger}>{trip.passenger_name ?? 'Sin nombre'}</Text>
              <Text style={styles.address} numberOfLines={1}>
                ▲ {trip.pickup_location?.address ?? '—'}
              </Text>
              <Text style={styles.address} numberOfLines={1}>
                ▼ {trip.dropoff_location?.address ?? '—'}
              </Text>
              {chip && (
                <Text
                  style={[
                    styles.flightChip,
                    (trip.flight_status === 'cancelled' || (trip.flight_delay_minutes ?? 0) >= 15) && styles.flightChipAlert,
                  ]}
                >
                  {chip}
                </Text>
              )}
            </Pressable>
          )
        })
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1d1b18' },
  content: { padding: 20, paddingTop: 12, flexGrow: 1, gap: 12 },
  center: { flex: 1, backgroundColor: '#1d1b18', justifyContent: 'center', alignItems: 'center' },
  emptyCard: { backgroundColor: '#2a2723', borderRadius: 16, padding: 24, alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#a8a39a', fontSize: 15, textAlign: 'center' },
  card: { backgroundColor: '#2a2723', borderRadius: 16, padding: 16 },
  cardNext: { borderWidth: 1, borderColor: '#e9c176' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  bookingNumber: { color: '#8a6520', fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  nextBadge: { color: '#e9c176', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  statusLabel: { color: '#f5f2ec', fontSize: 17, fontWeight: '700', marginBottom: 6 },
  passenger: { color: '#f5f2ec', fontSize: 14, marginBottom: 4 },
  address: { color: '#a8a39a', fontSize: 12, marginBottom: 2 },
  flightChip: { color: '#a8a39a', fontSize: 12, marginTop: 6 },
  flightChipAlert: { color: '#e9a154', fontWeight: '600' },
})
