import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Linking, TextInput } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { callDriverApi } from '../lib/api'
import { uploadPassengerSignature } from '../lib/upload'
import { useDriverLocationReporter } from '../lib/locationReporter'
import { SignaturePad } from '../components/SignaturePad'
import { PressableScale } from '../components/PressableScale'
import { Button, Card, ScreenLoader, SectionLabel, StatusBadge } from '../components/ui'
import { color, font, radius, space } from '../lib/theme'
import { NEXT_ACTION_LABEL, type BookingStatus, type DriverBooking, type TripsStackParamList } from '../lib/types'

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

const ACTION_ICON: Partial<Record<BookingStatus, keyof typeof Ionicons.glyphMap>> = {
  assigned: 'navigate',
  en_route: 'flag',
  arrived: 'play',
  in_progress: 'checkmark-done',
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

  const { pauseNotice, dismissPauseNotice } = useDriverLocationReporter(trip?.id ?? '', trip?.status ?? 'pending')

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

  if (loading) return <ScreenLoader />

  if (!trip) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={28} color={color.inkFaint} />
        <Text style={styles.emptyText}>Este viaje ya no está disponible.</Text>
      </View>
    )
  }

  const pickup = trip.pickup_location?.address ?? ''
  const dropoff = trip.dropoff_location?.address ?? ''

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {pauseNotice && (
        <PressableScale style={styles.pauseBanner} onPress={dismissPauseNotice}>
          <Ionicons name="location-outline" size={16} color={color.warning} />
          <Text style={styles.pauseBannerText}>
            Tu ubicación dejó de compartirse mientras la app estuvo en segundo plano
          </Text>
        </PressableScale>
      )}

      <Card>
        <View style={styles.topRow}>
          <Text style={styles.bookingNumber}>{trip.booking_number}</Text>
          <StatusBadge status={trip.status} />
        </View>

        <View style={styles.divider} />

        <SectionLabel>Pasajero</SectionLabel>
        <Text style={styles.passengerName}>{trip.passenger_name ?? 'Sin nombre'}</Text>

        {trip.passenger_phone && (
          <View style={styles.contactRow}>
            <PressableScale style={styles.contactButton} onPress={() => Linking.openURL(`tel:${trip.passenger_phone}`)}>
              <Ionicons name="call" size={16} color={color.ink} />
              <Text style={styles.contactButtonText}>Llamar</Text>
            </PressableScale>
            <PressableScale
              style={styles.contactButton}
              onPress={() => Linking.openURL(whatsappUrl(trip.passenger_phone!))}
            >
              <Ionicons name="logo-whatsapp" size={16} color={color.success} />
              <Text style={styles.contactButtonText}>WhatsApp</Text>
            </PressableScale>
          </View>
        )}
      </Card>

      <Card>
        <SectionLabel>Ruta</SectionLabel>

        <View style={styles.routeBlock}>
          <View style={styles.routeStop}>
            <View style={styles.routeIconCol}>
              <View style={[styles.routeDot, styles.routeDotPickup]} />
              <View style={styles.routeLine} />
            </View>
            <View style={styles.routeText}>
              <Text style={styles.routeLabel}>Recogida</Text>
              <Text style={styles.routeAddress}>{pickup || 'Sin dirección'}</Text>
              {!!pickup && (
                <View style={styles.navRow}>
                  <PressableScale style={styles.navButton} onPress={() => Linking.openURL(wazeUrl(pickup))}>
                    <Ionicons name="navigate-outline" size={13} color={color.gold} />
                    <Text style={styles.navButtonText}>Waze</Text>
                  </PressableScale>
                  <PressableScale style={styles.navButton} onPress={() => Linking.openURL(mapsUrl(pickup))}>
                    <Ionicons name="map-outline" size={13} color={color.gold} />
                    <Text style={styles.navButtonText}>Google Maps</Text>
                  </PressableScale>
                </View>
              )}
            </View>
          </View>

          <View style={styles.routeStop}>
            <View style={styles.routeIconCol}>
              <View style={[styles.routeDot, styles.routeDotDropoff]} />
            </View>
            <View style={styles.routeText}>
              <Text style={styles.routeLabel}>Destino</Text>
              <Text style={styles.routeAddress}>{dropoff || 'Sin dirección'}</Text>
              {!!dropoff && (
                <View style={styles.navRow}>
                  <PressableScale style={styles.navButton} onPress={() => Linking.openURL(wazeUrl(dropoff))}>
                    <Ionicons name="navigate-outline" size={13} color={color.gold} />
                    <Text style={styles.navButtonText}>Waze</Text>
                  </PressableScale>
                  <PressableScale style={styles.navButton} onPress={() => Linking.openURL(mapsUrl(dropoff))}>
                    <Ionicons name="map-outline" size={13} color={color.gold} />
                    <Text style={styles.navButtonText}>Google Maps</Text>
                  </PressableScale>
                </View>
              )}
            </View>
          </View>
        </View>
      </Card>

      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={16} color={color.danger} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}

      {!showComplete && NEXT_ACTION_LABEL[trip.status] && (
        <Button
          label={NEXT_ACTION_LABEL[trip.status]!}
          icon={ACTION_ICON[trip.status]}
          onPress={advance}
          loading={advancing}
          haptic="medium"
        />
      )}

      {showComplete && (
        <Card>
          <Text style={styles.sectionTitle}>Completar viaje</Text>

          <SectionLabel>¿Cobraste en efectivo? (opcional)</SectionLabel>
          <View style={styles.cashInputWrap}>
            <Text style={styles.cashSign}>$</Text>
            <TextInput
              style={styles.cashInput}
              placeholder="0.00"
              placeholderTextColor={color.inkFaint}
              keyboardType="decimal-pad"
              value={cashAmount}
              onChangeText={setCashAmount}
            />
          </View>

          <SignaturePad onSave={setSignatureBase64} onSkip={() => setSignatureBase64(null)} />
          {signatureBase64 && (
            <View style={styles.signatureSavedRow}>
              <Ionicons name="checkmark-circle" size={14} color={color.success} />
              <Text style={styles.signatureSaved}>Firma capturada</Text>
            </View>
          )}

          <Button
            label="Completar viaje"
            icon="checkmark-done"
            onPress={completeTrip}
            loading={advancing}
            style={styles.completeButton}
            haptic="medium"
          />
        </Card>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  content: { padding: space.xl, gap: space.md, flexGrow: 1 },
  center: { flex: 1, backgroundColor: color.bg, justifyContent: 'center', alignItems: 'center', gap: space.sm },
  emptyText: { color: color.inkFaint, fontFamily: font.body, fontSize: 14 },
  pauseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: color.warningSoft,
    borderWidth: 1,
    borderColor: `${color.warning}55`,
    borderRadius: radius.md,
    padding: space.md,
  },
  pauseBannerText: { flex: 1, color: color.warning, fontFamily: font.bodyMedium, fontSize: 12, lineHeight: 17 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bookingNumber: { color: color.inkFaint, fontFamily: font.bodySemi, fontSize: 12, letterSpacing: 1 },
  divider: { height: 1, backgroundColor: color.border, marginVertical: space.lg },
  passengerName: { color: color.ink, fontFamily: font.displaySemi, fontSize: 20, marginTop: space.xs, marginBottom: space.lg },
  contactRow: { flexDirection: 'row', gap: space.sm },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  contactButtonText: { color: color.ink, fontFamily: font.bodySemi, fontSize: 13 },
  routeBlock: { marginTop: space.md },
  routeStop: { flexDirection: 'row', gap: space.md },
  routeIconCol: { width: 14, alignItems: 'center' },
  routeDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  routeDotPickup: { borderColor: color.gold, backgroundColor: color.bg },
  routeDotDropoff: { borderColor: color.inkMuted, backgroundColor: color.bg },
  routeLine: { width: 1, flex: 1, minHeight: 36, backgroundColor: color.border, marginTop: 4, marginBottom: 4 },
  routeText: { flex: 1, paddingBottom: space.lg },
  routeLabel: { color: color.inkFaint, fontFamily: font.bodySemi, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
  routeAddress: { color: color.ink, fontFamily: font.body, fontSize: 14, marginTop: 4, lineHeight: 19 },
  navRow: { flexDirection: 'row', gap: space.lg, marginTop: space.sm },
  navButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  navButtonText: { color: color.gold, fontFamily: font.bodySemi, fontSize: 12 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs },
  error: { color: color.danger, fontFamily: font.bodyMedium, fontSize: 13, flexShrink: 1 },
  sectionTitle: { color: color.ink, fontFamily: font.displaySemi, fontSize: 18, marginBottom: space.lg },
  cashInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.lg,
    marginTop: space.sm,
    marginBottom: space.lg,
  },
  cashSign: { color: color.inkFaint, fontFamily: font.bodySemi, fontSize: 15, marginRight: 4 },
  cashInput: { flex: 1, color: color.ink, fontFamily: font.bodyMedium, fontSize: 15, paddingVertical: 12 },
  signatureSavedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: space.sm },
  signatureSaved: { color: color.success, fontFamily: font.bodyMedium, fontSize: 12 },
  completeButton: { marginTop: space.lg },
})
