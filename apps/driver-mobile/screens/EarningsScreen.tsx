import { useCallback, useMemo, useState } from 'react'
import { View, Text, StyleSheet, RefreshControl, ScrollView, TextInput } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { callDriverApi } from '../lib/api'
import { PressableScale } from '../components/PressableScale'
import { Button, Card, EmptyState, ScreenLoader, SectionLabel } from '../components/ui'
import { color, font, radius, space } from '../lib/theme'
import type { DriverBooking } from '../lib/types'

interface CompletedTrip
  extends Pick<DriverBooking, 'id' | 'booking_number' | 'passenger_name' | 'total_amount' | 'currency' | 'completed_at'> {
  driver_rated_at: string | null
}

const RANGE_OPTIONS = [
  { days: 7, label: '7 días' },
  { days: 15, label: '15 días' },
  { days: 30, label: '30 días' },
] as const

// Cubre el rango más amplio (30 días) en un solo fetch — cambiar de rango
// solo filtra en cliente, sin volver a golpear la red.
const FETCH_WINDOW_DAYS = 30

function TripRow({ trip, isFirst, onRated }: { trip: CompletedTrip; isFirst: boolean; onRated: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submitRating() {
    if (stars < 1) return
    setSubmitting(true)
    const result = await callDriverApi('rate-passenger', { bookingId: trip.id, rating: stars, comment })
    setSubmitting(false)
    if (result.success) {
      setExpanded(false)
      onRated(trip.id)
    }
  }

  return (
    <View style={[styles.tripRow, !isFirst && styles.tripRowDivider]}>
      <View style={styles.tripRowMain}>
        <View style={styles.tripIconWrap}>
          <Ionicons name="checkmark" size={14} color={color.success} />
        </View>
        <View style={styles.tripInfo}>
          <Text style={styles.tripPassenger}>{trip.passenger_name ?? 'Sin nombre'}</Text>
          <Text style={styles.tripMeta}>
            {trip.booking_number} ·{' '}
            {trip.completed_at
              ? new Date(trip.completed_at).toLocaleDateString('es-DO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '—'}
          </Text>
        </View>
        <Text style={styles.tripAmount}>{trip.total_amount != null ? `$${Number(trip.total_amount).toFixed(2)}` : '—'}</Text>
      </View>

      {trip.driver_rated_at ? (
        <View style={styles.ratedRow}>
          <Ionicons name="star" size={12} color={color.gold} />
          <Text style={styles.ratedText}>Pasajero calificado</Text>
        </View>
      ) : (
        <PressableScale style={styles.rateButton} onPress={() => setExpanded((v) => !v)}>
          <Ionicons name="star-outline" size={13} color={color.gold} />
          <Text style={styles.rateButtonText}>Calificar pasajero</Text>
        </PressableScale>
      )}

      {expanded && (
        <View style={styles.ratingPanel}>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <PressableScale key={n} style={styles.starButton} onPress={() => setStars(n)} haptic="light" hitSlop={6}>
                <Ionicons name={n <= stars ? 'star' : 'star-outline'} size={26} color={color.gold} />
              </PressableScale>
            ))}
          </View>
          <TextInput
            style={styles.commentInput}
            placeholder="Comentario (opcional)"
            placeholderTextColor={color.inkFaint}
            value={comment}
            onChangeText={setComment}
          />
          <Button label="Guardar calificación" icon="checkmark" onPress={submitRating} loading={submitting} disabled={stars < 1} />
        </View>
      )}
    </View>
  )
}

export function EarningsScreen() {
  const [totalEarnings, setTotalEarnings] = useState<number | null>(null)
  const [totalTrips, setTotalTrips] = useState(0)
  const [trips, setTrips] = useState<CompletedTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [rangeDays, setRangeDays] = useState<number>(7)

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const windowStart = new Date(Date.now() - FETCH_WINDOW_DAYS * 86_400_000).toISOString()

    const [{ data: driverRow }, { data: tripRows }] = await Promise.all([
      supabase.from('drivers').select('total_earnings, total_trips').eq('id', user.id).maybeSingle(),
      supabase
        .from('bookings')
        .select('id, booking_number, passenger_name, total_amount, currency, completed_at, driver_rated_at')
        .eq('driver_id', user.id)
        .eq('status', 'completed')
        .gte('completed_at', windowStart)
        .order('completed_at', { ascending: false })
        .limit(300),
    ])

    setTotalEarnings(driverRow?.total_earnings ?? 0)
    setTotalTrips(driverRow?.total_trips ?? 0)
    setTrips((tripRows as CompletedTrip[] | null) ?? [])
    setLoading(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  function markRated(id: string) {
    setTrips((prev) => prev.map((t) => (t.id === id ? { ...t, driver_rated_at: new Date().toISOString() } : t)))
  }

  const rangedTrips = useMemo(() => {
    const cutoff = Date.now() - rangeDays * 86_400_000
    return trips.filter((t) => t.completed_at && new Date(t.completed_at).getTime() >= cutoff)
  }, [trips, rangeDays])

  const rangedEarnings = useMemo(
    () => rangedTrips.reduce((sum, t) => sum + (t.total_amount ?? 0), 0),
    [rangedTrips],
  )

  if (loading) return <ScreenLoader />

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={color.gold} />}
    >
      <Text style={styles.headerTitle}>Ganancias</Text>

      <LinearGradient colors={[color.surfaceRaised, color.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
        <Text style={styles.heroLabel}>GANANCIAS TOTALES</Text>
        <Text style={styles.heroValue}>${Number(totalEarnings ?? 0).toFixed(2)}</Text>
        <View style={styles.heroFooter}>
          <Ionicons name="car-sport" size={13} color={color.inkFaint} />
          <Text style={styles.heroFooterText}>{totalTrips} viaje{totalTrips === 1 ? '' : 's'} completado{totalTrips === 1 ? '' : 's'}</Text>
        </View>
      </LinearGradient>

      <View style={styles.rangeHeader}>
        <SectionLabel>Período</SectionLabel>
        <View style={styles.rangeToggle}>
          {RANGE_OPTIONS.map((opt) => (
            <PressableScale
              key={opt.days}
              style={[styles.rangeButton, rangeDays === opt.days && styles.rangeButtonActive]}
              onPress={() => setRangeDays(opt.days)}
            >
              <Text style={[styles.rangeButtonText, rangeDays === opt.days && styles.rangeButtonTextActive]}>{opt.label}</Text>
            </PressableScale>
          ))}
        </View>
      </View>

      <Card style={styles.rangeStatCard}>
        <Text style={styles.rangeStatValue}>${rangedEarnings.toFixed(2)}</Text>
        <View style={styles.rangeStatFooter}>
          <Ionicons name="checkmark-done" size={13} color={color.inkFaint} />
          <Text style={styles.rangeStatFooterText}>
            {rangedTrips.length} viaje{rangedTrips.length === 1 ? '' : 's'} completado{rangedTrips.length === 1 ? '' : 's'} en los últimos {rangeDays} días
          </Text>
        </View>
      </Card>

      <SectionLabel>Viajes completados</SectionLabel>

      {rangedTrips.length === 0 ? (
        <EmptyState icon="wallet-outline" title="Sin viajes en este período" subtitle="Prueba con un rango más amplio, o aún no has completado viajes." />
      ) : (
        <Card style={styles.listCard}>
          {rangedTrips.map((t, i) => (
            <TripRow key={t.id} trip={t} isFirst={i === 0} onRated={markRated} />
          ))}
        </Card>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  content: { padding: space.xl, paddingTop: space.lg, gap: space.lg, flexGrow: 1 },
  headerTitle: { color: color.ink, fontFamily: font.display, fontSize: 28, marginBottom: -space.xs },
  heroCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.xxl,
    alignItems: 'center',
  },
  heroLabel: { color: color.inkFaint, fontFamily: font.bodySemi, fontSize: 11, letterSpacing: 1.5 },
  heroValue: { color: color.gold, fontFamily: font.display, fontSize: 44, marginTop: space.sm },
  heroFooter: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: space.md },
  heroFooterText: { color: color.inkFaint, fontFamily: font.body, fontSize: 12 },
  rangeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rangeToggle: {
    flexDirection: 'row',
    backgroundColor: color.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    padding: 3,
  },
  rangeButton: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill },
  rangeButtonActive: { backgroundColor: color.gold },
  rangeButtonText: { color: color.inkMuted, fontFamily: font.bodySemi, fontSize: 12 },
  rangeButtonTextActive: { color: color.bg },
  rangeStatCard: { alignItems: 'center', paddingVertical: space.xl },
  rangeStatValue: { color: color.ink, fontFamily: font.displaySemi, fontSize: 28 },
  rangeStatFooter: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: space.sm },
  rangeStatFooterText: { color: color.inkFaint, fontFamily: font.body, fontSize: 12 },
  listCard: { padding: 0, overflow: 'hidden' },
  tripRow: { padding: space.lg },
  tripRowDivider: { borderTopWidth: 1, borderTopColor: color.border },
  tripRowMain: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  tripIconWrap: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: color.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripInfo: { flex: 1 },
  tripPassenger: { color: color.ink, fontFamily: font.bodyMedium, fontSize: 14 },
  tripMeta: { color: color.inkFaint, fontFamily: font.body, fontSize: 11, marginTop: 2 },
  tripAmount: { color: color.ink, fontFamily: font.bodyBold, fontSize: 15 },
  ratedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: space.sm, marginLeft: 42 },
  ratedText: { color: color.inkFaint, fontFamily: font.body, fontSize: 11 },
  rateButton: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: space.sm, marginLeft: 42 },
  rateButtonText: { color: color.gold, fontFamily: font.bodySemi, fontSize: 12 },
  ratingPanel: { marginTop: space.md, marginLeft: 42, gap: space.sm },
  starsRow: { flexDirection: 'row', gap: space.xs },
  starButton: { padding: space.sm },
  commentInput: {
    backgroundColor: color.bg,
    color: color.ink,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontFamily: font.body,
    fontSize: 13,
  },
})
