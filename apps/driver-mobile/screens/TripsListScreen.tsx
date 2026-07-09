import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, RefreshControl, ScrollView, Animated } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { PressableScale } from '../components/PressableScale'
import { Card, EmptyState, ScreenLoader, StatusBadge } from '../components/ui'
import { color, font, radius, space } from '../lib/theme'
import { ACTIVE_STATUSES, type DriverBooking, type TripsStackParamList } from '../lib/types'

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

function flightChip(trip: DriverBooking): { label: string; alert: boolean } | null {
  if (!trip.flight_number) return null
  if (trip.flight_status === 'cancelled') return { label: `${trip.flight_number} · Cancelado`, alert: true }
  if ((trip.flight_delay_minutes ?? 0) >= 15) return { label: `${trip.flight_number} · +${trip.flight_delay_minutes} min`, alert: true }
  if (trip.flight_status === 'arrived') return { label: `${trip.flight_number} · Aterrizó`, alert: false }
  if (trip.flight_status === 'enroute') return { label: `${trip.flight_number} · En vuelo`, alert: false }
  return { label: trip.flight_number, alert: false }
}

function TripCard({ trip, isNext, index, onPress }: { trip: DriverBooking; isNext: boolean; index: number; onPress: () => void }) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 320, delay: index * 70, useNativeDriver: true }).start()
  }, [anim, index])

  const chip = flightChip(trip)

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }}
    >
      <PressableScale onPress={onPress} haptic="light">
        <Card style={isNext ? styles.cardNext : undefined}>
          <View style={styles.cardTopRow}>
            <Text style={styles.bookingNumber}>{trip.booking_number}</Text>
            <Ionicons name="chevron-forward" size={18} color={color.inkFaint} />
          </View>

          {isNext && (
            <View style={styles.nextChip}>
              <Ionicons name="time" size={12} color={color.gold} />
              <Text style={styles.nextChipText}>PRÓXIMO · {countdownLabel(trip.scheduled_at)}</Text>
            </View>
          )}

          <View style={styles.statusRow}>
            <StatusBadge status={trip.status} />
          </View>

          <View style={styles.passengerRow}>
            <Ionicons name="person-circle-outline" size={16} color={color.inkMuted} />
            <Text style={styles.passenger}>{trip.passenger_name ?? 'Sin nombre'}</Text>
          </View>

          <View style={styles.addressBlock}>
            <View style={styles.addressRow}>
              <Ionicons name="radio-button-on" size={14} color={color.gold} />
              <Text style={styles.address} numberOfLines={1}>{trip.pickup_location?.address ?? 'Sin dirección'}</Text>
            </View>
            <View style={styles.addressConnector} />
            <View style={styles.addressRow}>
              <Ionicons name="location" size={14} color={color.inkMuted} />
              <Text style={styles.address} numberOfLines={1}>{trip.dropoff_location?.address ?? 'Sin dirección'}</Text>
            </View>
          </View>

          {chip && (
            <View style={styles.flightChip}>
              <Ionicons name="airplane" size={12} color={chip.alert ? color.warning : color.inkFaint} />
              <Text style={[styles.flightChipText, chip.alert && styles.flightChipTextAlert]}>{chip.label}</Text>
            </View>
          )}
        </Card>
      </PressableScale>
    </Animated.View>
  )
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

  if (loading) return <ScreenLoader />

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={loadTrips} tintColor={color.gold} />}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Hoy</Text>
        <Text style={styles.headerSubtitle}>
          {trips.length === 0 ? 'Sin viajes activos' : `${trips.length} viaje${trips.length === 1 ? '' : 's'} activo${trips.length === 1 ? '' : 's'}`}
        </Text>
      </View>

      {trips.length === 0 ? (
        <EmptyState
          icon="car-sport-outline"
          title="No tienes viajes activos"
          subtitle="Cuando te asignen un viaje, aparecerá aquí al instante."
        />
      ) : (
        trips.map((trip, i) => (
          <TripCard
            key={trip.id}
            trip={trip}
            isNext={i === 0}
            index={i}
            onPress={() => navigation.navigate('TripDetail', { tripId: trip.id })}
          />
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  content: { padding: space.xl, paddingTop: space.lg, flexGrow: 1, gap: space.md },
  header: { marginBottom: space.xs },
  headerTitle: { color: color.ink, fontFamily: font.display, fontSize: 28 },
  headerSubtitle: { color: color.inkFaint, fontFamily: font.body, fontSize: 13, marginTop: 2 },
  cardNext: { borderColor: `${color.gold}66` },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bookingNumber: { color: color.inkFaint, fontFamily: font.bodySemi, fontSize: 11, letterSpacing: 1 },
  nextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: space.sm,
  },
  nextChipText: { color: color.gold, fontFamily: font.bodyBold, fontSize: 11, letterSpacing: 0.5 },
  statusRow: { marginTop: space.md, marginBottom: space.md },
  passengerRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginBottom: space.md },
  passenger: { color: color.ink, fontFamily: font.bodyMedium, fontSize: 15 },
  addressBlock: { gap: 2 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  addressConnector: { width: 1, height: 10, backgroundColor: color.border, marginLeft: 6.5 },
  address: { color: color.inkMuted, fontFamily: font.body, fontSize: 13, flexShrink: 1 },
  flightChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  flightChipText: { color: color.inkFaint, fontFamily: font.bodyMedium, fontSize: 12 },
  flightChipTextAlert: { color: color.warning },
})
