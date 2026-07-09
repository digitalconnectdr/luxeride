import { useCallback, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView, Linking, TextInput } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { supabase } from '../lib/supabase'
import { callDriverApi } from '../lib/api'
import { uploadPassengerSignature } from '../lib/upload'
import { SignaturePad } from '../components/SignaturePad'
import { NEXT_ACTION_LABEL, STATUS_LABEL, type DriverBooking, type TripsStackParamList } from '../lib/types'

const BOOKING_COLUMNS =
  'id, booking_number, status, passenger_name, passenger_phone, scheduled_at, pickup_location, dropoff_location, flight_number, flight_status, flight_delay_minutes, total_amount, currency, completed_at'

function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}
function wazeUrl(address: string) {
  return `https://www.waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`
}
function whatsappUrl(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, '')}`
}

type Props = NativeStackScreenProps<TripsStackParamList, 'TripDetail'>

export function TripDetailScreen({ route, navigation }: Props) {
  const { tripId } = route.params
  const [trip, setTrip] = useState<DriverBooking | null>(null)
  const [loading, setLoading] = useState(true)
  const [advancing, setAdvancing] = useState(false)
  const [error, setError] = useState('')
  const [showComplete, setShowComplete] = useState(false)
  const [cashAmount, setCashAmount] = useState('')
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null)

  const loadTrip = useCallback(async () => {
    const { data } = await supabase.from('bookings').select(BOOKING_COLUMNS).eq('id', tripId).maybeSingle()
    setTrip((data as DriverBooking | null) ?? null)
    setLoading(false)
  }, [tripId])

  useFocusEffect(
    useCallback(() => {
      loadTrip()
    }, [loadTrip]),
  )

  async function advance() {
    if (!trip) return
    // Completar viaje pasa por un flujo aparte (pago + firma), no un avance directo.
    if (trip.status === 'in_progress') {
      setShowComplete(true)
      return
    }
    setAdvancing(true)
    setError('')
    const result = await callDriverApi('advance-trip', { bookingId: trip.id })
    setAdvancing(false)
    if (!result.success) setError(result.error ?? 'No se pudo actualizar el viaje')
    else await loadTrip()
  }

  async function completeTrip() {
    if (!trip) return
    setAdvancing(true)
    setError('')

    let signaturePath: string | undefined
    if (signatureBase64) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { path, error: uploadError } = await uploadPassengerSignature(user.id, trip.id, signatureBase64)
        if (uploadError) {
          setAdvancing(false)
          setError('No se pudo guardar la firma, intenta de nuevo')
          return
        }
        signaturePath = path
      }
    }

    const amount = cashAmount.trim() ? Number(cashAmount.replace(',', '.')) : undefined
    if (amount != null && (!Number.isFinite(amount) || amount <= 0)) {
      setAdvancing(false)
      setError('Monto en efectivo inválido')
      return
    }

    const result = await callDriverApi('complete-trip', { bookingId: trip.id, cashAmount: amount, signaturePath })
    setAdvancing(false)
    if (!result.success) {
      setError(result.error ?? 'No se pudo completar el viaje')
    } else {
      setShowComplete(false)
      navigation.goBack()
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#e9c176" />
      </View>
    )
  }

  if (!trip) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Este viaje ya no está disponible.</Text>
      </View>
    )
  }

  const pickup = trip.pickup_location?.address ?? ''
  const dropoff = trip.dropoff_location?.address ?? ''

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.bookingNumber}>{trip.booking_number}</Text>
        <Text style={styles.statusLabel}>{STATUS_LABEL[trip.status] ?? trip.status}</Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Pasajero</Text>
          <Text style={styles.rowValue}>{trip.passenger_name ?? 'Sin nombre'}</Text>
        </View>

        {trip.passenger_phone && (
          <View style={styles.contactRow}>
            <Pressable style={styles.contactButton} onPress={() => Linking.openURL(`tel:${trip.passenger_phone}`)}>
              <Text style={styles.contactButtonText}>📞 Llamar</Text>
            </Pressable>
            <Pressable style={styles.contactButton} onPress={() => Linking.openURL(whatsappUrl(trip.passenger_phone!))}>
              <Text style={styles.contactButtonText}>💬 WhatsApp</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.row}>
          <Text style={styles.rowLabel}>▲ Recogida</Text>
          <Text style={styles.rowValue}>{pickup || '—'}</Text>
          {!!pickup && (
            <View style={styles.navRow}>
              <Pressable style={styles.navButton} onPress={() => Linking.openURL(wazeUrl(pickup))}>
                <Text style={styles.navButtonText}>Waze ↗</Text>
              </Pressable>
              <Pressable style={styles.navButton} onPress={() => Linking.openURL(mapsUrl(pickup))}>
                <Text style={styles.navButtonText}>Google Maps ↗</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>▼ Destino</Text>
          <Text style={styles.rowValue}>{dropoff || '—'}</Text>
          {!!dropoff && (
            <View style={styles.navRow}>
              <Pressable style={styles.navButton} onPress={() => Linking.openURL(wazeUrl(dropoff))}>
                <Text style={styles.navButtonText}>Waze ↗</Text>
              </Pressable>
              <Pressable style={styles.navButton} onPress={() => Linking.openURL(mapsUrl(dropoff))}>
                <Text style={styles.navButtonText}>Google Maps ↗</Text>
              </Pressable>
            </View>
          )}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!showComplete && NEXT_ACTION_LABEL[trip.status] && (
          <Pressable style={styles.actionButton} onPress={advance} disabled={advancing}>
            {advancing ? (
              <ActivityIndicator color="#1d1b18" />
            ) : (
              <Text style={styles.actionButtonText}>{NEXT_ACTION_LABEL[trip.status]}</Text>
            )}
          </Pressable>
        )}
      </View>

      {showComplete && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Completar viaje</Text>

          <Text style={styles.rowLabel}>¿Cobraste en efectivo? (opcional)</Text>
          <TextInput
            style={styles.cashInput}
            placeholder="Monto en efectivo, ej. 45.00"
            placeholderTextColor="#75716a"
            keyboardType="decimal-pad"
            value={cashAmount}
            onChangeText={setCashAmount}
          />

          <SignaturePad onSave={setSignatureBase64} onSkip={() => setSignatureBase64(null)} />
          {signatureBase64 && <Text style={styles.signatureSaved}>✓ Firma capturada</Text>}

          <Pressable style={styles.actionButton} onPress={completeTrip} disabled={advancing}>
            {advancing ? (
              <ActivityIndicator color="#1d1b18" />
            ) : (
              <Text style={styles.actionButtonText}>✓ Completar viaje</Text>
            )}
          </Pressable>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1d1b18' },
  content: { padding: 20, gap: 16, flexGrow: 1 },
  center: { flex: 1, backgroundColor: '#1d1b18', justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#a8a39a', fontSize: 15 },
  card: { backgroundColor: '#2a2723', borderRadius: 16, padding: 20, gap: 4 },
  bookingNumber: { color: '#8a6520', fontSize: 13, fontWeight: '600', letterSpacing: 1 },
  statusLabel: { color: '#f5f2ec', fontSize: 22, fontWeight: '700', marginTop: 6, marginBottom: 16 },
  sectionTitle: { color: '#f5f2ec', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  row: { marginBottom: 14 },
  rowLabel: { color: '#75716a', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  rowValue: { color: '#f5f2ec', fontSize: 16 },
  contactRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  contactButton: { flex: 1, backgroundColor: '#3a352e', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  contactButtonText: { color: '#f5f2ec', fontSize: 13, fontWeight: '600' },
  navRow: { flexDirection: 'row', gap: 14, marginTop: 6 },
  navButton: {},
  navButtonText: { color: '#e9c176', fontSize: 12, fontWeight: '600' },
  error: { color: '#e57373', fontSize: 13, marginBottom: 8 },
  actionButton: { backgroundColor: '#e9c176', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 10 },
  actionButtonText: { color: '#1d1b18', fontWeight: '700', fontSize: 16 },
  cashInput: {
    backgroundColor: '#1d1b18',
    color: '#f5f2ec',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 16,
  },
  signatureSaved: { color: '#8fbf8f', fontSize: 12, marginTop: 8 },
})
