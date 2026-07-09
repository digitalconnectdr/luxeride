import { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, RefreshControl, ScrollView } from 'react-native'
import { supabase } from '../lib/supabase'
import { NEXT_ACTION_LABEL, STATUS_LABEL, type DriverBooking } from '../lib/types'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!
const ACTIVE_STATUSES = ['assigned', 'en_route', 'arrived', 'in_progress']

export function TripScreen() {
  const [trip, setTrip] = useState<DriverBooking | null>(null)
  const [loading, setLoading] = useState(true)
  const [advancing, setAdvancing] = useState(false)
  const [error, setError] = useState('')

  // Lectura directa a Supabase — RLS (drivers_select_assigned_bookings) ya
  // restringe esto a los viajes de ESTE conductor, no hace falta pasar por
  // una ruta API propia para leer.
  const loadTrip = useCallback(async () => {
    setError('')
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    // Esta app es SOLO para conductores — si alguien más entra con sus
    // credenciales (ej. un owner probando), no debe ver nada de otros roles.
    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'driver') {
      setError('Esta app es solo para conductores.')
      setLoading(false)
      await supabase.auth.signOut()
      return
    }

    const { data, error: queryError } = await supabase
      .from('bookings')
      .select('id, booking_number, status, passenger_name, scheduled_at, pickup_location, dropoff_location')
      .eq('driver_id', user.id)
      .in('status', ACTIVE_STATUSES)
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (queryError) setError(queryError.message)
    setTrip((data as DriverBooking | null) ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadTrip()
  }, [loadTrip])

  async function advance() {
    if (!trip) return
    setAdvancing(true)
    setError('')

    const {
      data: { session },
    } = await supabase.auth.getSession()

    try {
      const res = await fetch(`${API_BASE_URL}/api/mobile/driver/advance-trip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ bookingId: trip.id }),
      })
      const result = await res.json()
      if (!result.success) {
        setError(result.error ?? 'No se pudo actualizar el viaje')
      } else {
        await loadTrip()
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setAdvancing(false)
    }
  }

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
      refreshControl={<RefreshControl refreshing={false} onRefresh={loadTrip} tintColor="#e9c176" />}
    >
      <Pressable onPress={() => supabase.auth.signOut()} style={styles.signOut}>
        <Text style={styles.signOutText}>Cerrar sesión</Text>
      </Pressable>

      {!trip ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No tienes viajes activos ahora mismo.</Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.bookingNumber}>{trip.booking_number}</Text>
          <Text style={styles.statusLabel}>{STATUS_LABEL[trip.status] ?? trip.status}</Text>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Pasajero</Text>
            <Text style={styles.rowValue}>{trip.passenger_name ?? 'Sin nombre'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>▲ Recogida</Text>
            <Text style={styles.rowValue}>{trip.pickup_location?.address ?? '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>▼ Destino</Text>
            <Text style={styles.rowValue}>{trip.dropoff_location?.address ?? '—'}</Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {NEXT_ACTION_LABEL[trip.status] && (
            <Pressable style={styles.actionButton} onPress={advance} disabled={advancing}>
              {advancing ? (
                <ActivityIndicator color="#1d1b18" />
              ) : (
                <Text style={styles.actionButtonText}>{NEXT_ACTION_LABEL[trip.status]}</Text>
              )}
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1d1b18' },
  content: { padding: 20, paddingTop: 60, flexGrow: 1 },
  center: { flex: 1, backgroundColor: '#1d1b18', justifyContent: 'center', alignItems: 'center' },
  signOut: { alignSelf: 'flex-end', marginBottom: 16 },
  signOutText: { color: '#75716a', fontSize: 13 },
  emptyCard: { backgroundColor: '#2a2723', borderRadius: 16, padding: 24, alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#a8a39a', fontSize: 15, textAlign: 'center' },
  card: { backgroundColor: '#2a2723', borderRadius: 16, padding: 20 },
  bookingNumber: { color: '#8a6520', fontSize: 13, fontWeight: '600', letterSpacing: 1 },
  statusLabel: { color: '#f5f2ec', fontSize: 22, fontWeight: '700', marginTop: 6, marginBottom: 20 },
  row: { marginBottom: 14 },
  rowLabel: { color: '#75716a', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  rowValue: { color: '#f5f2ec', fontSize: 16 },
  error: { color: '#e57373', fontSize: 13, marginTop: 8, marginBottom: 8 },
  actionButton: { backgroundColor: '#e9c176', borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginTop: 16 },
  actionButtonText: { color: '#1d1b18', fontWeight: '700', fontSize: 17 },
})
