import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, RefreshControl, ScrollView } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { Card, EmptyState, ScreenLoader, SectionLabel } from '../components/ui'
import { color, font, radius, space } from '../lib/theme'
import type { DriverBooking } from '../lib/types'

interface CompletedTrip extends Pick<DriverBooking, 'id' | 'booking_number' | 'passenger_name' | 'total_amount' | 'currency' | 'completed_at'> {}

export function EarningsScreen() {
  const [totalEarnings, setTotalEarnings] = useState<number | null>(null)
  const [totalTrips, setTotalTrips] = useState(0)
  const [trips, setTrips] = useState<CompletedTrip[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: driverRow }, { data: tripRows }] = await Promise.all([
      supabase.from('drivers').select('total_earnings, total_trips').eq('id', user.id).maybeSingle(),
      supabase
        .from('bookings')
        .select('id, booking_number, passenger_name, total_amount, currency, completed_at')
        .eq('driver_id', user.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(30),
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

      <SectionLabel>Últimos viajes completados</SectionLabel>

      {trips.length === 0 ? (
        <EmptyState icon="wallet-outline" title="Aún no tienes viajes completados" subtitle="Tus ganancias aparecerán aquí a medida que completes viajes." />
      ) : (
        <Card style={styles.listCard}>
          {trips.map((t, i) => (
            <View key={t.id} style={[styles.tripRow, i > 0 && styles.tripRowDivider]}>
              <View style={styles.tripIconWrap}>
                <Ionicons name="checkmark" size={14} color={color.success} />
              </View>
              <View style={styles.tripInfo}>
                <Text style={styles.tripPassenger}>{t.passenger_name ?? 'Sin nombre'}</Text>
                <Text style={styles.tripMeta}>
                  {t.booking_number} · {t.completed_at ? new Date(t.completed_at).toLocaleDateString('es-DO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                </Text>
              </View>
              <Text style={styles.tripAmount}>{t.total_amount != null ? `$${Number(t.total_amount).toFixed(2)}` : '—'}</Text>
            </View>
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
  listCard: { padding: 0, overflow: 'hidden' },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  tripRowDivider: { borderTopWidth: 1, borderTopColor: color.border },
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
})
