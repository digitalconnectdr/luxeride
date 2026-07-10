import { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Linking, TextInput, Image } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { callDriverApi } from '../lib/api'
import { uploadPassengerSignature } from '../lib/upload'
import { useDriverLocationReporter } from '../lib/locationReporter'
import { SignatureModal } from '../components/SignatureModal'
import { PressableScale } from '../components/PressableScale'
import { Button, Card, ScreenLoader, SectionLabel } from '../components/ui'
import { color, font, radius, space, STATUS_COLOR } from '../lib/theme'
import { NEXT_ACTION_LABEL, STATUS_LABEL, type BookingStatus, type DriverBooking, type TripsStackParamList } from '../lib/types'

const BOOKING_COLUMNS =
  'id, booking_number, status, passenger_name, passenger_phone, scheduled_at, pickup_location, dropoff_location, flight_number, flight_status, flight_delay_minutes, total_amount, currency, completed_at'

const MAP_VISIBLE_STATUSES = new Set<BookingStatus>(['en_route', 'arrived'])

function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}
function wazeUrl(address: string) {
  return `https://www.waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`
}
function whatsappUrl(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, '')}`
}

const STATUS_ICON: Partial<Record<BookingStatus, keyof typeof Ionicons.glyphMap>> = {
  assigned: 'navigate-circle',
  en_route: 'car',
  arrived: 'location',
  in_progress: 'flag',
  completed: 'checkmark-circle',
}

const ACTION_ICON: Partial<Record<BookingStatus, keyof typeof Ionicons.glyphMap>> = {
  assigned: 'navigate',
  en_route: 'flag',
  arrived: 'play',
  in_progress: 'checkmark-done',
}

const ACTIVE_INCIDENT_STATUSES = new Set<BookingStatus>(['en_route', 'arrived', 'in_progress'])

const INCIDENT_CATEGORIES: { value: string; label: string }[] = [
  { value: 'accident', label: 'Accidente' },
  { value: 'breakdown', label: 'Avería del vehículo' },
  { value: 'safety', label: 'Seguridad' },
  { value: 'unable_to_reach_passenger', label: 'No localizo al pasajero' },
  { value: 'other', label: 'Otro' },
]

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
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [showIncident, setShowIncident] = useState(false)
  const [incidentCategory, setIncidentCategory] = useState<string | null>(null)
  const [incidentReason, setIncidentReason] = useState('')
  const [reportingIncident, setReportingIncident] = useState(false)
  const [incidentSent, setIncidentSent] = useState(false)
  const [mapUrl, setMapUrl] = useState<string | null>(null)
  const [mapFailed, setMapFailed] = useState(false)

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

  // Mapa con la posición del pasajero (si compartió ubicación) mientras el
  // conductor va en camino o ya está en el punto de recogida.
  useEffect(() => {
    if (!trip || !MAP_VISIBLE_STATUSES.has(trip.status)) {
      setMapUrl(null)
      return
    }
    let cancelled = false
    setMapFailed(false)
    callDriverApi<{ mapUrl?: string | null }>('trip-map', { bookingId: trip.id }).then((res) => {
      if (!cancelled) setMapUrl(res.mapUrl ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [trip?.id, trip?.status])

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

  async function rejectTrip() {
    if (!trip) return
    setRejecting(true)
    setError('')
    const result = await callDriverApi('reject-trip', { bookingId: trip.id, reason: rejectReason })
    setRejecting(false)
    if (!result.success) setError(result.error ?? 'No se pudo rechazar el viaje')
    else navigation.goBack()
  }

  async function submitIncident() {
    if (!trip || !incidentCategory) return
    setReportingIncident(true)
    setError('')
    const result = await callDriverApi('report-incident', {
      bookingId: trip.id,
      category: incidentCategory,
      reason: incidentReason,
    })
    setReportingIncident(false)
    if (!result.success) {
      setError(result.error ?? 'No se pudo registrar el incidente')
    } else {
      setShowIncident(false)
      setIncidentCategory(null)
      setIncidentReason('')
      setIncidentSent(true)
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
  const statusTint = STATUS_COLOR[trip.status] ?? color.inkMuted

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
        <Text style={styles.bookingNumber}>{trip.booking_number}</Text>

        <View style={[styles.statusHero, { backgroundColor: `${statusTint}1c`, borderColor: `${statusTint}55` }]}>
          <Ionicons name={STATUS_ICON[trip.status] ?? 'ellipse'} size={15} color={statusTint} />
          <Text style={[styles.statusHeroText, { color: statusTint }]} numberOfLines={1}>
            {STATUS_LABEL[trip.status] ?? trip.status}
          </Text>
        </View>

        <View style={styles.divider} />

        <SectionLabel>Pasajero</SectionLabel>
        <Text style={styles.passengerName}>{trip.passenger_name ?? 'Sin nombre'}</Text>

        <PressableScale style={styles.chatButton} onPress={() => navigation.navigate('Chat', { tripId: trip.id })} haptic="light">
          <Ionicons name="chatbubble-ellipses" size={18} color={color.bg} />
          <Text style={styles.chatButtonText}>Chat con el pasajero</Text>
        </PressableScale>

        {trip.passenger_phone && (
          <View style={styles.contactRow}>
            <PressableScale style={styles.contactButton} onPress={() => Linking.openURL(`tel:${trip.passenger_phone}`)}>
              <Ionicons name="call-outline" size={18} color={color.inkMuted} />
              <Text style={styles.contactButtonText}>Llamar</Text>
            </PressableScale>
            <PressableScale
              style={styles.contactButton}
              onPress={() => Linking.openURL(whatsappUrl(trip.passenger_phone!))}
            >
              <Ionicons name="logo-whatsapp" size={18} color={color.success} />
              <Text style={styles.contactButtonText}>WhatsApp</Text>
            </PressableScale>
          </View>
        )}
      </Card>

      {MAP_VISIBLE_STATUSES.has(trip.status) && mapUrl && !mapFailed && (
        <Card style={styles.mapCard}>
          <SectionLabel>Ubicación</SectionLabel>
          <Image source={{ uri: mapUrl }} style={styles.mapImage} onError={() => setMapFailed(true)} />
        </Card>
      )}

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

      {!showComplete && !showReject && !showIncident && (trip.status === 'assigned' || ACTIVE_INCIDENT_STATUSES.has(trip.status)) && (
        <View style={styles.secondaryActionsRow}>
          {trip.status === 'assigned' && (
            <PressableScale style={styles.secondaryAction} onPress={() => setShowReject(true)}>
              <Ionicons name="close-circle-outline" size={15} color={color.danger} />
              <Text style={styles.secondaryActionTextDanger}>Rechazar viaje</Text>
            </PressableScale>
          )}
          {ACTIVE_INCIDENT_STATUSES.has(trip.status) && !incidentSent && (
            <PressableScale style={styles.secondaryAction} onPress={() => setShowIncident(true)}>
              <Ionicons name="warning-outline" size={15} color={color.warning} />
              <Text style={styles.secondaryActionText}>Reportar incidente</Text>
            </PressableScale>
          )}
        </View>
      )}

      {incidentSent && (
        <View style={styles.incidentSentRow}>
          <Ionicons name="checkmark-circle" size={14} color={color.success} />
          <Text style={styles.incidentSentText}>Incidente reportado al equipo de operaciones</Text>
        </View>
      )}

      {showReject && (
        <Card>
          <Text style={styles.sectionTitle}>Rechazar viaje</Text>
          <SectionLabel>Motivo (opcional)</SectionLabel>
          <TextInput
            style={styles.reasonInput}
            placeholder="Ej. muy lejos de mi ubicación actual"
            placeholderTextColor={color.inkFaint}
            value={rejectReason}
            onChangeText={setRejectReason}
            multiline
          />
          <View style={styles.formActionsRow}>
            <Button
              label="Cancelar"
              variant="secondary"
              onPress={() => setShowReject(false)}
              disabled={rejecting}
              style={styles.formActionButton}
            />
            <Button
              label="Confirmar rechazo"
              icon="close-circle"
              variant="danger"
              onPress={rejectTrip}
              loading={rejecting}
              haptic="medium"
              style={styles.formActionButton}
            />
          </View>
        </Card>
      )}

      {showIncident && (
        <Card>
          <Text style={styles.sectionTitle}>Reportar incidente</Text>
          <SectionLabel>Categoría</SectionLabel>
          <View style={styles.categoryChips}>
            {INCIDENT_CATEGORIES.map((c) => (
              <PressableScale
                key={c.value}
                style={[styles.categoryChip, incidentCategory === c.value && styles.categoryChipActive]}
                onPress={() => setIncidentCategory(c.value)}
              >
                <Text style={[styles.categoryChipText, incidentCategory === c.value && styles.categoryChipTextActive]}>
                  {c.label}
                </Text>
              </PressableScale>
            ))}
          </View>

          <SectionLabel>Describe brevemente lo ocurrido</SectionLabel>
          <TextInput
            style={styles.reasonInput}
            placeholder="¿Qué pasó?"
            placeholderTextColor={color.inkFaint}
            value={incidentReason}
            onChangeText={setIncidentReason}
            multiline
          />

          <View style={styles.formActionsRow}>
            <Button
              label="Cancelar"
              variant="secondary"
              onPress={() => setShowIncident(false)}
              disabled={reportingIncident}
              style={styles.formActionButton}
            />
            <Button
              label="Enviar reporte"
              icon="send"
              onPress={submitIncident}
              loading={reportingIncident}
              disabled={!incidentCategory || !incidentReason.trim()}
              haptic="medium"
              style={styles.formActionButton}
            />
          </View>
        </Card>
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

          <View style={styles.divider} />

          <SectionLabel>Firma del pasajero (opcional)</SectionLabel>
          <PressableScale style={styles.signatureField} onPress={() => setShowSignatureModal(true)}>
            {signatureBase64 ? (
              <>
                <Ionicons name="checkmark-circle" size={18} color={color.success} />
                <Text style={styles.signatureFieldTextSaved}>Firma capturada · toca para cambiar</Text>
              </>
            ) : (
              <>
                <Ionicons name="create-outline" size={18} color={color.gold} />
                <Text style={styles.signatureFieldText}>Toca para capturar la firma</Text>
              </>
            )}
          </PressableScale>

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

      <SignatureModal
        visible={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        onSave={setSignatureBase64}
      />
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
  bookingNumber: { color: color.inkFaint, fontFamily: font.bodySemi, fontSize: 12, letterSpacing: 1 },
  statusHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: space.md,
    marginTop: space.sm,
  },
  statusHeroText: { fontFamily: font.bodyBold, fontSize: 14 },
  divider: { height: 1, backgroundColor: color.border, marginVertical: space.lg },
  passengerName: { color: color.ink, fontFamily: font.displaySemi, fontSize: 20, marginTop: space.xs, marginBottom: space.lg },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: 15,
    borderRadius: radius.md,
    backgroundColor: color.gold,
  },
  chatButtonText: { color: color.bg, fontFamily: font.bodyBold, fontSize: 15 },
  contactRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
    borderRadius: radius.md,
    paddingVertical: 14,
  },
  contactButtonText: { color: color.ink, fontFamily: font.bodySemi, fontSize: 14 },
  mapCard: { padding: 0, overflow: 'hidden' },
  mapImage: { width: '100%', height: 180 },
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
  navButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10, paddingHorizontal: 2 },
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
  },
  cashSign: { color: color.inkFaint, fontFamily: font.bodySemi, fontSize: 15, marginRight: 4 },
  cashInput: { flex: 1, color: color.ink, fontFamily: font.bodyMedium, fontSize: 15, paddingVertical: 12 },
  signatureField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: color.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    marginTop: space.sm,
  },
  signatureFieldText: { color: color.gold, fontFamily: font.bodyMedium, fontSize: 13 },
  signatureFieldTextSaved: { color: color.success, fontFamily: font.bodyMedium, fontSize: 13 },
  completeButton: { marginTop: space.lg },
  secondaryActionsRow: { flexDirection: 'row', justifyContent: 'center', gap: space.xl },
  secondaryAction: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: space.sm },
  secondaryActionText: { color: color.inkMuted, fontFamily: font.bodyMedium, fontSize: 13 },
  secondaryActionTextDanger: { color: color.danger, fontFamily: font.bodyMedium, fontSize: 13 },
  incidentSentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  incidentSentText: { color: color.success, fontFamily: font.bodyMedium, fontSize: 12 },
  reasonInput: {
    backgroundColor: color.bg,
    color: color.ink,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.md,
    fontFamily: font.body,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
    marginTop: space.sm,
    marginBottom: space.lg,
  },
  formActionsRow: { flexDirection: 'row', gap: space.sm },
  formActionButton: { flex: 1 },
  categoryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm, marginBottom: space.lg },
  categoryChip: {
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  categoryChipActive: { backgroundColor: `${color.warning}22`, borderColor: color.warning },
  categoryChipText: { color: color.inkMuted, fontFamily: font.bodyMedium, fontSize: 12 },
  categoryChipTextActive: { color: color.warning },
})
