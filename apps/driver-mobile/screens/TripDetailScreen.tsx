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

type ExtraChargeType = 'extra_passenger' | 'extra_luggage' | 'toll_parking'

interface TripFees {
  passengerFee: number
  luggageFee: number
  currency: string
  noShowGraceMinutes: number
}

const BOOKING_COLUMNS =
  'id, booking_number, status, passenger_name, passenger_phone, scheduled_at, pickup_location, dropoff_location, flight_number, flight_status, flight_delay_minutes, total_amount, currency, completed_at, payment_method_intent, special_instructions, passenger_preferences, arrived_at, meet_and_greet, sign_name'

function formatMinutesSeconds(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Preferencias congeladas en la reserva (ver migración 76 + 85). */
interface TripPreferences {
  conversation?: string
  temperature?: string
  music?: string
  luggageHelp?: boolean
  preferredDriverGender?: string
}

const CONVERSATION_LABEL: Record<string, string> = {
  quiet: 'Prefiere silencio',
  chatty: 'Abierto a conversar',
}
const TEMPERATURE_LABEL: Record<string, string> = {
  cool: 'Clima: fresco',
  mild: 'Clima: templado',
  warm: 'Clima: cálido',
}
const MUSIC_LABEL: Record<string, string> = {
  none: 'Sin música',
  soft: 'Música suave',
  driver_choice: 'Música a tu elección',
}
const GENDER_LABEL: Record<string, string> = {
  female: 'Prefiere conductora',
  male: 'Prefiere conductor',
}

/** Solo lo que el pasajero SÍ pidió — omitir "sin preferencia" evita que la
 * lista se llene de ruido y se ignore entera. */
function preferenceLines(p: TripPreferences | null): string[] {
  if (!p) return []
  const out: string[] = []
  if (p.conversation && CONVERSATION_LABEL[p.conversation]) out.push(CONVERSATION_LABEL[p.conversation])
  if (p.temperature && TEMPERATURE_LABEL[p.temperature]) out.push(TEMPERATURE_LABEL[p.temperature])
  if (p.music && MUSIC_LABEL[p.music]) out.push(MUSIC_LABEL[p.music])
  if (p.luggageHelp) out.push('Necesita ayuda con el equipaje')
  if (p.preferredDriverGender && GENDER_LABEL[p.preferredDriverGender]) out.push(GENDER_LABEL[p.preferredDriverGender])
  return out
}

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

// Mismo set que STOP_ALLOWED en app/actions/trip.ts (web) — mientras el viaje
// esté en alguno de estos estados, el conductor puede agregar un cargo extra.
const STOP_ALLOWED = new Set<BookingStatus>(['assigned', 'en_route', 'arrived', 'in_progress'])

const CHARGE_TYPE_LABEL: Record<ExtraChargeType, string> = {
  extra_passenger: 'Pasajero extra',
  extra_luggage: 'Equipaje extra',
  toll_parking: 'Peaje / parking',
}

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
  const [fees, setFees] = useState<TripFees | null>(null)
  const [showAddCharge, setShowAddCharge] = useState(false)
  const [chargeType, setChargeType] = useState<ExtraChargeType>('extra_passenger')
  const [chargeQty, setChargeQty] = useState(1)
  const [chargeAmount, setChargeAmount] = useState('')
  const [chargeError, setChargeError] = useState('')
  const [addingCharge, setAddingCharge] = useState(false)
  const [chargeDone, setChargeDone] = useState<{ amount: number; currency: string } | null>(null)
  const [showNoShow, setShowNoShow] = useState(false)
  const [noShowSubmitting, setNoShowSubmitting] = useState(false)

  const { pauseNotice, dismissPauseNotice, backgroundUnavailable, openSettingsForBackground } =
    useDriverLocationReporter(trip?.id ?? '', trip?.status ?? 'pending')

  // Countdown de cortesía antes de poder marcar no-show — el servidor
  // (markDriverNoShow) ya lo valida de todos modos; esto es solo para no
  // dejar tocar un botón que el servidor va a rechazar. graceDeadline y
  // graceActive se calculan de forma SÍNCRONA en cada render (a diferencia
  // de graceRemaining, que es estado y por tanto tarda un render en
  // actualizarse) — a diferencia de la web, aquí `fees` llega por un fetch
  // asíncrono después del montaje, así que si el gating dependiera del
  // estado en vez de este cálculo síncrono, el botón "No-show" podría
  // parpadear visible por un render antes de que el efecto lo corrija.
  const graceDeadline =
    trip?.status === 'arrived' && trip.arrived_at && fees
      ? new Date(trip.arrived_at).getTime() + fees.noShowGraceMinutes * 60_000
      : null
  const graceActive = graceDeadline !== null && graceDeadline > Date.now()
  const [graceRemaining, setGraceRemaining] = useState(() =>
    graceDeadline ? Math.max(0, Math.ceil((graceDeadline - Date.now()) / 1000)) : 0,
  )
  useEffect(() => {
    if (!graceDeadline) {
      setGraceRemaining(0)
      return
    }
    const tick = () => setGraceRemaining(Math.max(0, Math.ceil((graceDeadline - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [graceDeadline])

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

  // Montos de cargo extra configurados por el operador — antes esto solo
  // existía en el portal web (driverAddExtraChargeAction); el conductor con
  // la app nativa no tenía cómo cobrar peaje/parking/equipaje extra en ruta.
  useEffect(() => {
    if (!trip || !STOP_ALLOWED.has(trip.status)) {
      setFees(null)
      return
    }
    let cancelled = false
    callDriverApi<TripFees>('trip-fees', { bookingId: trip.id }).then((res) => {
      if (!cancelled && res.success) setFees(res)
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

  async function confirmAddCharge() {
    if (!trip) return
    const customAmount = chargeType === 'toll_parking' ? Number(chargeAmount.replace(',', '.')) : undefined
    if (chargeType === 'toll_parking' && (!Number.isFinite(customAmount) || (customAmount ?? 0) <= 0)) {
      setChargeError('Monto inválido')
      return
    }
    if (chargeType === 'toll_parking' && (customAmount ?? 0) > 500) {
      setChargeError('El monto máximo por cargo es 500. Para montos mayores, contacta a soporte.')
      return
    }
    setChargeError('')
    setAddingCharge(true)
    const result = await callDriverApi<{ amount?: number; currency?: string }>('add-charge', {
      bookingId: trip.id,
      type: chargeType,
      qty: chargeQty,
      customAmount,
    })
    setAddingCharge(false)
    if (!result.success || result.amount == null) {
      setChargeError(result.error ?? 'No se pudo registrar el cargo')
    } else {
      setShowAddCharge(false)
      setChargeQty(1)
      setChargeAmount('')
      setChargeDone({ amount: result.amount, currency: result.currency ?? 'USD' })
    }
  }

  async function confirmNoShow() {
    if (!trip) return
    setNoShowSubmitting(true)
    setError('')
    const result = await callDriverApi('no-show', { bookingId: trip.id })
    setNoShowSubmitting(false)
    if (!result.success) setError(result.error ?? 'No se pudo marcar no-show')
    else navigation.goBack()
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

      {backgroundUnavailable && (
        <PressableScale style={styles.pauseBanner} onPress={openSettingsForBackground}>
          <Ionicons name="location-outline" size={16} color={color.warning} />
          <Text style={styles.pauseBannerText}>
            Solo compartes tu ubicación con la app abierta. Activa &quot;Permitir siempre&quot; en Configuración
            para que no se interrumpa si usas Waze o Google Maps.
          </Text>
        </PressableScale>
      )}

      {trip.meet_and_greet && (
        <View style={styles.meetGreetBanner}>
          <Ionicons name="reader-outline" size={18} color={color.gold} />
          <View style={styles.meetGreetTextWrap}>
            <Text style={styles.meetGreetTitle}>Meet &amp; Greet solicitado</Text>
            <Text style={styles.meetGreetText}>
              Sostén un letrero con: <Text style={styles.meetGreetName}>{trip.sign_name || trip.passenger_name || 'el pasajero'}</Text>
            </Text>
          </View>
        </View>
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

        {trip.payment_method_intent && (
          <View style={styles.paymentBadge}>
            <Ionicons
              name={trip.payment_method_intent === 'cash' ? 'cash-outline' : 'card-outline'}
              size={14}
              color={color.inkMuted}
            />
            <Text style={styles.paymentBadgeText}>
              {trip.payment_method_intent === 'cash' ? 'Paga en efectivo' : 'Paga con tarjeta'}
            </Text>
          </View>
        )}

        {/* Preferencias del pasajero — congeladas al reservar (migración 76).
        Van ANTES del chat: son lo que el conductor debe saber antes de
        arrancar, no algo que deba preguntar. */}
        {(() => {
          const lines = preferenceLines(trip.passenger_preferences as TripPreferences | null)
          if (!lines.length) return null
          return (
            <View style={styles.prefsBox}>
              <Text style={styles.prefsTitle}>Preferencias del pasajero</Text>
              {lines.map((line) => (
                <View key={line} style={styles.prefRow}>
                  <Ionicons name="checkmark-circle-outline" size={13} color={color.gold} />
                  <Text style={styles.prefText}>{line}</Text>
                </View>
              ))}
            </View>
          )
        })()}

        {/* Instrucciones del viaje — el conductor no las veía en ningún lado,
        aunque el pasajero las escribía al reservar. */}
        {trip.special_instructions ? (
          <View style={styles.prefsBox}>
            <Text style={styles.prefsTitle}>Instrucciones</Text>
            <Text style={styles.prefText}>{trip.special_instructions}</Text>
          </View>
        ) : null}

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

      {!showComplete && !showAddCharge && !showReject && !showIncident && !showNoShow && NEXT_ACTION_LABEL[trip.status] && (
        <Button
          label={NEXT_ACTION_LABEL[trip.status]!}
          icon={ACTION_ICON[trip.status]}
          onPress={advance}
          loading={advancing}
          haptic="medium"
        />
      )}

      {trip.status === 'arrived' && graceActive && (
        <Text style={styles.graceBanner}>
          Cortesía de espera: {formatMinutesSeconds(graceRemaining)} restantes
        </Text>
      )}

      {!showComplete && !showReject && !showIncident && !showAddCharge && !showNoShow && STOP_ALLOWED.has(trip.status) && (
        <View style={styles.secondaryActionsRow}>
          {trip.status === 'assigned' && (
            <PressableScale style={styles.secondaryAction} onPress={() => setShowReject(true)}>
              <Ionicons name="close-circle-outline" size={15} color={color.danger} />
              <Text style={styles.secondaryActionTextDanger}>Rechazar viaje</Text>
            </PressableScale>
          )}
          {trip.status === 'arrived' && fees && !graceActive && (
            <PressableScale style={styles.secondaryAction} onPress={() => setShowNoShow(true)}>
              <Ionicons name="alert-circle-outline" size={15} color={color.danger} />
              <Text style={styles.secondaryActionTextDanger}>No-show</Text>
            </PressableScale>
          )}
          {fees && (
            <PressableScale
              style={styles.secondaryAction}
              onPress={() => {
                setChargeType(fees.passengerFee > 0 ? 'extra_passenger' : fees.luggageFee > 0 ? 'extra_luggage' : 'toll_parking')
                setChargeQty(1)
                setChargeAmount('')
                setChargeError('')
                setChargeDone(null)
                setShowAddCharge(true)
              }}
            >
              <Ionicons name="pricetag-outline" size={15} color={color.gold} />
              <Text style={styles.secondaryActionText}>Agregar cargo</Text>
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

      {chargeDone && (
        <View style={styles.incidentSentRow}>
          <Ionicons name="checkmark-circle" size={14} color={color.success} />
          <Text style={styles.incidentSentText}>
            Cargo agregado: +{chargeDone.amount.toFixed(2)} {chargeDone.currency}
          </Text>
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

      {showNoShow && (
        <Card>
          <Text style={styles.sectionTitle}>No-show</Text>
          <Text style={styles.noShowQuestionText}>
            ¿Marcar que el pasajero no se presentó? Esto cancela el viaje.
          </Text>
          <View style={styles.formActionsRow}>
            <Button
              label="Volver"
              variant="secondary"
              onPress={() => setShowNoShow(false)}
              disabled={noShowSubmitting}
              style={styles.formActionButton}
            />
            <Button
              label="Confirmar no-show"
              icon="alert-circle"
              variant="danger"
              onPress={confirmNoShow}
              loading={noShowSubmitting}
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

      {showAddCharge && fees && (
        <Card>
          <Text style={styles.sectionTitle}>Agregar cargo</Text>
          <SectionLabel>Tipo</SectionLabel>
          <View style={styles.categoryChips}>
            {([
              ...(fees.passengerFee > 0 ? (['extra_passenger'] as const) : []),
              ...(fees.luggageFee > 0 ? (['extra_luggage'] as const) : []),
              'toll_parking',
            ] satisfies ExtraChargeType[]).map((t) => (
              <PressableScale
                key={t}
                style={[styles.categoryChip, chargeType === t && styles.categoryChipActive]}
                onPress={() => setChargeType(t)}
              >
                <Text style={[styles.categoryChipText, chargeType === t && styles.categoryChipTextActive]}>
                  {CHARGE_TYPE_LABEL[t]}
                </Text>
              </PressableScale>
            ))}
          </View>

          {chargeType === 'toll_parking' ? (
            <>
              <SectionLabel>Monto</SectionLabel>
              <View style={styles.cashInputWrap}>
                <Text style={styles.cashSign}>{fees.currency}</Text>
                <TextInput
                  style={styles.cashInput}
                  placeholder="0.00"
                  placeholderTextColor={color.inkFaint}
                  keyboardType="decimal-pad"
                  value={chargeAmount}
                  onChangeText={setChargeAmount}
                />
              </View>
            </>
          ) : (
            <>
              <SectionLabel>Cantidad</SectionLabel>
              <View style={styles.qtyRow}>
                <PressableScale
                  style={[styles.qtyButton, chargeQty <= 1 && styles.qtyButtonDisabled]}
                  onPress={() => setChargeQty((q) => Math.max(1, q - 1))}
                  disabled={chargeQty <= 1}
                  hitSlop={8}
                >
                  <Ionicons name="remove" size={16} color={color.ink} />
                </PressableScale>
                <Text style={styles.qtyValue}>{chargeQty}</Text>
                <PressableScale
                  style={[styles.qtyButton, chargeQty >= 10 && styles.qtyButtonDisabled]}
                  onPress={() => setChargeQty((q) => Math.min(10, q + 1))}
                  disabled={chargeQty >= 10}
                  hitSlop={8}
                >
                  <Ionicons name="add" size={16} color={color.ink} />
                </PressableScale>
              </View>
            </>
          )}

          <Text style={styles.chargeTotalText}>
            Total:{' '}
            {(chargeType === 'toll_parking'
              ? Number(chargeAmount.replace(',', '.')) || 0
              : (chargeType === 'extra_passenger' ? fees.passengerFee : fees.luggageFee) * chargeQty
            ).toFixed(2)}{' '}
            {fees.currency}
          </Text>
          {!!chargeError && <Text style={styles.chargeErrorText}>{chargeError}</Text>}

          <View style={styles.formActionsRow}>
            <Button
              label="Cancelar"
              variant="secondary"
              onPress={() => { setShowAddCharge(false); setChargeError('') }}
              disabled={addingCharge}
              style={styles.formActionButton}
            />
            <Button
              label="Confirmar cargo"
              icon="pricetag"
              onPress={confirmAddCharge}
              loading={addingCharge}
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
  meetGreetBanner: {
    flexDirection: 'row',
    gap: space.sm,
    backgroundColor: `${color.gold}14`,
    borderWidth: 1,
    borderColor: `${color.gold}55`,
    borderRadius: radius.md,
    padding: space.md,
  },
  meetGreetTextWrap: { flex: 1 },
  meetGreetTitle: { color: color.gold, fontFamily: font.bodySemi, fontSize: 12, letterSpacing: 0.3 },
  meetGreetText: { color: color.ink, fontFamily: font.body, fontSize: 13, marginTop: 2, lineHeight: 18 },
  meetGreetName: { fontFamily: font.bodyBold },
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
  passengerName: { color: color.ink, fontFamily: font.displaySemi, fontSize: 20, marginTop: space.xs },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: space.xs,
    marginBottom: space.lg,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.border,
  },
  paymentBadgeText: { color: color.inkMuted, fontFamily: font.bodyMedium, fontSize: 11.5 },
  prefsBox: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceRaised,
    gap: 5,
  },
  prefsTitle: {
    color: color.inkFaint,
    fontFamily: font.bodySemi,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  prefText: { color: color.ink, fontFamily: font.body, fontSize: 13, flexShrink: 1, lineHeight: 18 },
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
  graceBanner: {
    textAlign: 'center',
    color: color.warning,
    fontFamily: font.bodyMedium,
    fontSize: 12,
    backgroundColor: color.warningSoft,
    borderWidth: 1,
    borderColor: `${color.warning}55`,
    borderRadius: radius.md,
    paddingVertical: 10,
  },
  noShowQuestionText: { color: color.inkMuted, fontFamily: font.body, fontSize: 13, marginBottom: space.lg, lineHeight: 18 },
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
  chargeErrorText: { color: color.danger, fontFamily: font.bodyMedium, fontSize: 12, marginTop: space.sm },
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
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.sm, marginBottom: space.lg },
  qtyButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonDisabled: { opacity: 0.4 },
  qtyValue: { color: color.ink, fontFamily: font.bodySemi, fontSize: 16, minWidth: 20, textAlign: 'center' },
  chargeTotalText: { color: color.gold, fontFamily: font.bodySemi, fontSize: 13, marginBottom: space.lg },
})
