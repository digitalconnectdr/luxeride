import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl, ScrollView } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import type { DriverBooking } from '../lib/types'

interface CompletedTrip extends Pick<DriverBooking, 'id' | 'booking_number' | 'passenger_name' | 'total_amount' | 'currency' | 'completed_at'> {}

export function EarningsScreen() {
  const [totalEarnings, setTotalEarnings] = useState<number | null>(null)
  const [trips, setTrips] = useState<CompletedTrip[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: driverRow }, { data: tripRows }] = await Promise.all([
      supabase.from('drivers').select('total_earnings').eq('id', user.id).maybeSingle(),
      supabase
        .from('bookings')
        .select('id, booking_number, passenger_name, total_amount, currency, completed_at')
        .eq('driver_id', user.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(30),
    ])

    setTotalEarnings(driverRow?.total_earnings ?? 0)
    setTrips((tripRows as CompletedTrip[] | null) ?? [])
    setLoading(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

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
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor="#e9c176" />}
    >
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Ganancias totales</Text>
        <Text style={styles.totalValue}>${Number(totalEarnings ?? 0).toFixed(2)}</Text>
      </View>

      <Text style={styles.sectionTitle}>Últimos viajes completados</Text>

      {trips.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Aún no tienes viajes completados.</Text>
        </View>
      ) : (
        trips.map((t) => (
          <View key={t.id} style={styles.tripRow}>
            <View style={styles.tripInfo}>
              <Text style={styles.tripNumber}>{t.booking_number}</Text>
              <Text style={styles.tripPassenger}>{t.passenger_name ?? 'Sin nombre'}</Text>
              <Text style={styles.tripDate}>
                {t.completed_at ? new Date(t.completed_at).toLocaleDateString('es-DO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
              </Text>
            </View>
            <Text style={styles.tripAmount}>
              {t.total_amount != null ? `$${Number(t.total_amount).toFixed(2)}` : '—'}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1d1b18' },
  content: { padding: 20, paddingTop: 12, gap: 12, flexGrow: 1 },
  center: { flex: 1, backgroundColor: '#1d1b18', justifyContent: 'center', alignItems: 'center' },
  totalCard: { backgroundColor: '#2a2723', borderRadius: 16, padding: 24, alignItems: 'center' },
  totalLabel: { color: '#a8a39a', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  totalValue: { color: '#e9c176', fontSize: 34, fontWeight: '700' },
  sectionTitle: { color: '#f5f2ec', fontSize: 15, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  emptyCard: { backgroundColor: '#2a2723', borderRadius: 16, padding: 24, alignItems: 'center' },
  emptyText: { color: '#a8a39a', fontSize: 14, textAlign: 'center' },
  tripRow: {
    backgroundColor: '#2a2723',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripInfo: { flex: 1 },
  tripNumber: { color: '#8a6520', fontSize: 11, fontWeight: '600' },
  tripPassenger: { color: '#f5f2ec', fontSize: 14, marginTop: 2 },
  tripDate: { color: '#75716a', fontSize: 11, marginTop: 2 },
  tripAmount: { color: '#f5f2ec', fontSize: 15, fontWeight: '700' },
})
