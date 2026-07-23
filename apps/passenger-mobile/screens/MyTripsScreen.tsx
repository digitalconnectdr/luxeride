// ── Historial de viajes del pasajero ────────────────────────────────────────
// Lee bookings directo por Supabase (RLS customers_select_own_bookings, ya
// existente) — antes esta pantalla era un placeholder fijo: si el pasajero
// cerraba la pantalla de "Reserva confirmada" sin tocar "Ver mi viaje", no
// tenía ninguna forma de volver a encontrar esa reserva. Tap en un viaje
// activo navega a TripTracking, que vive en el stack de la pestaña
// "Reservar" (navegación cross-tab: navigation.navigate('Reservar', { screen, params })).

import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, FlatList, RefreshControl, TextInput } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { callPassengerApi } from '../lib/api'
import { Button, Card, EmptyState, ScreenLoader, StatusBadge } from '../components/ui'
import { PressableScale } from '../components/PressableScale'
import { color, font, radius, space } from '../lib/theme'
import type { BookingStatus } from '../lib/types'

interface TripRow {
  id: string
  booking_number: string
  status: BookingStatus
  scheduled_at: string
  total_amount: number | null
  currency: string | null
  passenger_count: number
  rated_at: string | null
  pickup_location: { address?: string; lat?: number; lng?: number } | null
  dropoff_location: { address?: string; lat?: number; lng?: number } | null
}

const ACTIVE_STATUSES: BookingStatus[] = ['pending', 'assigned', 'en_route', 'arrived', 'in_progress']
// "Reservar de nuevo" solo tiene sentido para un viaje que ya se completó —
// uno cancelado/no-show no es una ruta que el pasajero probablemente quiera
// repetir tal cual (el motivo de la cancelación pudo ser la ruta misma).
const REBOOKABLE_STATUSES: BookingStatus[] = ['completed']

// Indicador de cercanía: mientras más cerca el viaje, más "urgente" el color
// (verde -> ámbar -> rojo), igual que el semáforo de StatusBadge pero para
// el tiempo restante en vez del estado.
function urgency(hoursUntil: number): { label: string; tint: string } {
  if (hoursUntil < 6) return { label: 'Muy pronto', tint: color.danger }
  if (hoursUntil < 24) return { label: 'Hoy', tint: color.warning }
  const days = Math.round(hoursUntil / 24)
  return { label: days <= 1 ? 'Mañana' : `En ${days} días`, tint: color.success }
}

interface TripCardProps {
  item: TripRow
  onNavigateTracking: () => void
  onRebook: () => void
  onRated: () => void
}

// Componente propio (no una función inline dentro de renderItem) porque el
// panel de calificación necesita su propio estado por tarjeta (expandido,
// estrellas, comentario) — un FlatList no da hooks-por-ítem si el render se
// queda como closure suelto. Mismo patrón que TripRow en
// apps/driver-mobile/screens/EarningsScreen.tsx ("Calificar pasajero"), aquí
// invertido: el PASAJERO califica el viaje/conductor.
function TripCard({ item, onNavigateTracking, onRebook, onRated }: TripCardProps) {
  const [ratingOpen, setRatingOpen] = useState(false)
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [ratingError, setRatingError] = useState('')

  const isActive = ACTIVE_STATUSES.includes(item.status)
  const date = new Date(item.scheduled_at)
  const hoursUntil = (date.getTime() - Date.now()) / 3_600_000
  const showUrgency = isActive && hoursUntil > 0 && hoursUntil < 240 // hasta 10 días
  const urgencyInfo = showUrgency ? urgency(hoursUntil) : null
  const canRebook =
    REBOOKABLE_STATUSES.includes(item.status) &&
    item.pickup_location?.lat != null && item.pickup_location?.lng != null &&
    item.dropoff_location?.lat != null && item.dropoff_location?.lng != null
  const canRate = item.status === 'completed' && !item.rated_at

  async function submitRating() {
    if (stars < 1) return
    setSubmitting(true)
    setRatingError('')
    const result = await callPassengerApi('submit-review', { bookingId: item.id, rating: stars, comment })
    setSubmitting(false)
    if (!result.success) {
      setRatingError('No se pudo enviar tu calificación. Intenta de nuevo.')
      return
    }
    setRatingOpen(false)
    onRated()
  }

  return (
    <PressableScale onPress={onNavigateTracking}>
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

        {canRebook && (
          <PressableScale onPress={onRebook}>
            <View style={styles.rebookBtn}>
              <Ionicons name="repeat-outline" size={14} color={color.gold} />
              <Text style={styles.rebookText}>Reservar de nuevo</Text>
            </View>
          </PressableScale>
        )}

        {item.rated_at ? (
          <View style={styles.ratedRow}>
            <Ionicons name="star" size={12} color={color.gold} />
            <Text style={styles.ratedText}>Ya calificaste este viaje</Text>
          </View>
        ) : canRate ? (
          <>
            <PressableScale onPress={() => setRatingOpen((v) => !v)}>
              <View style={styles.rateBtn}>
                <Ionicons name="star-outline" size={14} color={color.gold} />
                <Text style={styles.rateBtnText}>Calificar viaje</Text>
              </View>
            </PressableScale>

            {ratingOpen && (
              <View style={styles.ratingPanel}>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <PressableScale key={n} onPress={() => setStars(n)} haptic="light" hitSlop={6}>
                      <Ionicons name={n <= stars ? 'star' : 'star-outline'} size={28} color={color.gold} />
                    </PressableScale>
                  ))}
                </View>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Comentario (opcional)"
                  placeholderTextColor={color.inkFaint}
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  numberOfLines={2}
                />
                {ratingError ? <Text style={styles.ratingError}>{ratingError}</Text> : null}
                <Button label="Enviar calificación" icon="checkmark" onPress={submitRating} loading={submitting} disabled={stars < 1} />
              </View>
            )}
          </>
        ) : null}
      </Card>
    </PressableScale>
  )
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
      .select('id, booking_number, status, scheduled_at, total_amount, currency, passenger_count, rated_at, pickup_location, dropoff_location')
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

  function rebook(item: TripRow) {
    const pickup = item.pickup_location
    const dropoff = item.dropoff_location
    if (pickup?.lat == null || pickup?.lng == null || dropoff?.lat == null || dropoff?.lng == null) return
    navigation.navigate('Reservar', {
      screen: 'NewBooking',
      params: {
        prefill: {
          pickupAddress: pickup.address ?? '',
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          dropoffAddress: dropoff.address ?? '',
          dropoffLat: dropoff.lat,
          dropoffLng: dropoff.lng,
          passengerCount: item.passenger_count,
        },
      },
    })
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
      renderItem={({ item }) => (
        <TripCard
          item={item}
          onNavigateTracking={() =>
            navigation.navigate('Reservar', { screen: 'TripTracking', params: { bookingId: item.id } })
          }
          onRebook={() => rebook(item)}
          onRated={load}
        />
      )}
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
  price: { color: color.ink, fontFamily: font.bodyBold, fontSize: 16 },
  activeHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  activeHintText: { color: color.gold, fontFamily: font.bodyMedium, fontSize: 11 },
  rebookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: space.xs,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
  },
  rebookText: { color: color.gold, fontFamily: font.bodySemi, fontSize: 12 },
  ratedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  ratedText: { color: color.inkFaint, fontFamily: font.bodyMedium, fontSize: 11 },
  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: space.xs,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
  },
  rateBtnText: { color: color.gold, fontFamily: font.bodySemi, fontSize: 12 },
  ratingPanel: { marginTop: space.sm, gap: space.sm },
  starsRow: { flexDirection: 'row', gap: space.sm, alignSelf: 'center' },
  commentInput: {
    backgroundColor: color.bg,
    color: color.ink,
    fontFamily: font.body,
    fontSize: 13,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  ratingError: { color: color.danger, fontFamily: font.bodyMedium, fontSize: 12 },
})
