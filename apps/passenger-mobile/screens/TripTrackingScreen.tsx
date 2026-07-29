// ── Seguimiento en tiempo real del conductor ────────────────────────────────
// Lee la reserva directo por Supabase (RLS customers_select_own_bookings,
// ya existente) y se suscribe a trip_locations por Realtime — el pasajero
// autenticado SÍ puede leer payload.new directo (RLS
// customers_select_own_trip_locations, migración 62), a diferencia del
// guest anónimo de la web que necesita un side-channel de refetch vía
// server action. Mismo patrón de canal que
// apps/driver-mobile/screens/ChatScreen.tsx.
//
// Quién te recoge y en qué NO se puede leer por Supabase desde aquí:
// `drivers` y `vehicles` tienen RLS de staff (por company_id). Eso viene de
// /api/mobile/passenger/trip-detail, ruta con admin client + verificación de
// ownership, mismo patrón que `receipt`.
//
// Requiere una API key nativa de Google Maps para Android (ver
// .env.example) — sin ella, react-native-maps no renderiza el mapa, pero
// el resto de la pantalla (estado del viaje) sigue funcionando.

import { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Image, Linking, Share } from 'react-native'
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { supabase } from '../lib/supabase'
import { callPassengerApi } from '../lib/api'
import { decodePolyline, type LatLng } from '../lib/polyline'
import { PressableScale } from '../components/PressableScale'
import { ScreenLoader, StatusBadge, EmptyState, Button, MetaChip } from '../components/ui'
import { font, space, radius, useThemedStyles, usePalette, type Palette, type ShadowSet } from '../lib/theme'
import type { BookingStackParamList, BookingStatus } from '../lib/types'

type Props = NativeStackScreenProps<BookingStackParamList, 'TripTracking'>

// Mismo criterio que CHAT_CLOSED en apps/web/app/actions/trip.ts — una vez
// el viaje termina (o nunca se realizó), ya no tiene sentido coordinar por
// chat con el conductor.
const CHAT_CLOSED: BookingStatus[] = ['completed', 'cancelled', 'no_show']

interface TripBooking {
  status: BookingStatus
  bookingNumber: string
  scheduledAt: string
  pickup: { address?: string; lat?: number; lng?: number } | null
  dropoff: { address?: string; lat?: number; lng?: number } | null
  routePolyline: string | null
}

interface TripDetail {
  driver: {
    name: string | null
    phone: string | null
    photoUrl: string | null
    rating: number | null
    totalTrips: number | null
  } | null
  vehicle: {
    label: string
    year: number | null
    color: string | null
    plate: string | null
    typeName: string | null
    /** Foto de catálogo de la CLASE de vehículo (vehicle_types.base_image_url). */
    imageUrl: string | null
  } | null
  durationMinutes: number | null
  distanceMiles: number | null
}

export function TripTrackingScreen({ route, navigation }: Props) {
  const { bookingId } = route.params
  const styles = useThemedStyles(makeStyles)
  const c = usePalette()
  const [booking, setBooking] = useState<TripBooking | null>(null)
  const [detail, setDetail] = useState<TripDetail | null>(null)
  const [driverPos, setDriverPos] = useState<LatLng | null>(null)
  const [loadError, setLoadError] = useState('')
  const mapRef = useRef<MapView>(null)
  const fitDone = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('bookings')
        .select('status, booking_number, scheduled_at, pickup_location, dropoff_location, route_polyline')
        .eq('id', bookingId)
        .single()
      if (cancelled) return
      if (error || !data) {
        setLoadError('No pudimos cargar tu viaje')
        return
      }
      setBooking({
        status: data.status as BookingStatus,
        bookingNumber: data.booking_number,
        scheduledAt: data.scheduled_at as string,
        pickup: data.pickup_location as TripBooking['pickup'],
        dropoff: data.dropoff_location as TripBooking['dropoff'],
        routePolyline: (data.route_polyline as string | null) ?? null,
      })
    }
    load()
    return () => {
      cancelled = true
    }
  }, [bookingId])

  // Conductor + vehículo asignados. Se vuelve a pedir cuando cambia el
  // estado del viaje: al pasar de "pendiente" a "asignado" es justo cuando
  // aparecen por primera vez.
  useEffect(() => {
    let cancelled = false
    callPassengerApi<{ detail?: TripDetail }>('trip-detail', { bookingId }).then((r) => {
      if (cancelled) return
      if (r.success && r.detail) setDetail(r.detail)
    })
    return () => {
      cancelled = true
    }
  }, [bookingId, booking?.status])

  useEffect(() => {
    const channel = supabase
      .channel(`trip-location-${bookingId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trip_locations', filter: `booking_id=eq.${bookingId}` },
        (payload) => {
          const row = payload.new as { latitude: number; longitude: number; reporter: string }
          if (row.reporter !== 'driver') return
          setDriverPos({ latitude: row.latitude, longitude: row.longitude })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [bookingId])

  // Estado del viaje en tiempo real: sin esto, el texto (StatusBadge, banner
  // de espera, etc.) se quedaba en lo que había al montar la pantalla — el
  // pasajero no se enteraba de que el conductor avanzó el viaje hasta salir
  // y volver a entrar. Misma política RLS que ya usa el fetch inicial de
  // arriba (customers_select_own_bookings): no cambia con el UPDATE, así que
  // Realtime entrega el evento sin necesitar ninguna migración nueva.
  useEffect(() => {
    const channel = supabase
      .channel(`booking-status-${bookingId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${bookingId}` },
        (payload) => {
          const row = payload.new as { status: BookingStatus; route_polyline: string | null }
          setBooking((prev) =>
            prev ? { ...prev, status: row.status, routePolyline: row.route_polyline ?? prev.routePolyline } : prev,
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [bookingId])

  if (loadError) {
    return (
      <View style={styles.center}>
        <EmptyState icon="alert-circle-outline" title="No se pudo cargar el mapa" subtitle={loadError} />
      </View>
    )
  }

  if (!booking) return <ScreenLoader />

  const pickupCoord: LatLng | null =
    booking.pickup?.lat != null && booking.pickup?.lng != null
      ? { latitude: booking.pickup.lat, longitude: booking.pickup.lng }
      : null
  const dropoffCoord: LatLng | null =
    booking.dropoff?.lat != null && booking.dropoff?.lng != null
      ? { latitude: booking.dropoff.lat, longitude: booking.dropoff.lng }
      : null
  const routeCoords = booking.routePolyline ? decodePolyline(booking.routePolyline) : []

  const initialRegion = pickupCoord
    ? { ...pickupCoord, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : { latitude: 18.4861, longitude: -69.9312, latitudeDelta: 0.5, longitudeDelta: 0.5 }

  function fitMapToTrip() {
    if (fitDone.current || !mapRef.current) return
    const coords = [pickupCoord, dropoffCoord, driverPos].filter(Boolean) as LatLng[]
    if (coords.length < 2) return
    fitDone.current = true
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
      animated: true,
    })
  }

  async function shareTrip() {
    if (!booking) return
    const when = new Date(booking.scheduledAt).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' })
    const lines = [
      `Mi viaje ${booking.bookingNumber}`,
      `Recogida: ${booking.pickup?.address ?? '—'}`,
      `Destino: ${booking.dropoff?.address ?? '—'}`,
      `Fecha: ${when}`,
    ]
    if (detail?.driver?.name) lines.push(`Conductor: ${detail.driver.name}`)
    if (detail?.vehicle) {
      lines.push(
        `Vehículo: ${detail.vehicle.label}${detail.vehicle.color ? ` ${detail.vehicle.color}` : ''}${detail.vehicle.plate ? ` · ${detail.vehicle.plate}` : ''}`,
      )
    }
    try {
      await Share.share({ message: lines.join('\n') })
    } catch {
      /* el usuario canceló el diálogo del sistema */
    }
  }

  const pickupTime = new Date(booking.scheduledAt)
  const chatOpen = !CHAT_CLOSED.includes(booking.status)

  return (
    <View style={styles.container}>
      <View style={styles.statusBar}>
        <View style={styles.statusBarLeft}>
          <Text style={styles.bookingNumber}>{booking.bookingNumber}</Text>
          <StatusBadge status={booking.status} />
        </View>
        <View style={styles.pickupWrap}>
          <Text style={styles.pickupLabel}>Recogida</Text>
          <Text style={styles.pickupTime}>
            {pickupTime.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        customMapStyle={c.mapStyle}
        onMapReady={fitMapToTrip}
        onLayout={fitMapToTrip}
      >
        {routeCoords.length > 0 && <Polyline coordinates={routeCoords} strokeColor={c.gold} strokeWidth={4} />}
        {pickupCoord && (
          <Marker coordinate={pickupCoord} title="Origen">
            <View style={[styles.pin, { backgroundColor: c.gold }]} />
          </Marker>
        )}
        {dropoffCoord && (
          <Marker coordinate={dropoffCoord} title="Destino">
            <View style={[styles.pin, { backgroundColor: c.danger }]} />
          </Marker>
        )}
        {driverPos && (
          <Marker coordinate={driverPos} title="Tu conductor" onPress={fitMapToTrip}>
            <View style={styles.driverMarker}>
              <Ionicons name="car-sport" size={18} color={c.onGold} />
            </View>
          </Marker>
        )}
      </MapView>

      <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent}>
        {!driverPos && (
          <View style={styles.waitingBanner}>
            <Ionicons name="time-outline" size={15} color={c.inkFaint} />
            <Text style={styles.waitingText}>Esperando la ubicación de tu conductor…</Text>
          </View>
        )}

        {detail?.driver?.name ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Tu conductor</Text>
            <View style={styles.driverRow}>
              {detail.driver.photoUrl ? (
                <Image source={{ uri: detail.driver.photoUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Ionicons name="person" size={20} color={c.gold} />
                </View>
              )}
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>{detail.driver.name}</Text>
                <View style={styles.driverMeta}>
                  {detail.driver.rating != null && (
                    <>
                      <Ionicons name="star" size={12} color={c.gold} />
                      <Text style={styles.driverRating}>{detail.driver.rating.toFixed(1)}</Text>
                    </>
                  )}
                  <Text style={styles.driverRole}>
                    {detail.driver.totalTrips ? `${detail.driver.totalTrips} viajes` : 'Conductor profesional'}
                  </Text>
                </View>
              </View>
              <View style={styles.driverActions}>
                {detail.driver.phone && (
                  <PressableScale
                    onPress={() => Linking.openURL(`tel:${detail.driver!.phone}`)}
                    haptic="light"
                    hitSlop={6}
                  >
                    <View style={styles.circleButton}>
                      <Ionicons name="call" size={16} color={c.gold} />
                    </View>
                  </PressableScale>
                )}
                {chatOpen && (
                  <PressableScale
                    onPress={() => navigation.navigate('Chat', { bookingId })}
                    haptic="light"
                    hitSlop={6}
                  >
                    <View style={styles.circleButton}>
                      <Ionicons name="chatbubble-ellipses" size={16} color={c.gold} />
                    </View>
                  </PressableScale>
                )}
              </View>
            </View>
          </View>
        ) : chatOpen ? (
          // Todavía sin conductor asignado: el chat sigue disponible para
          // coordinar con la empresa, así que no se esconde el acceso.
          <PressableScale onPress={() => navigation.navigate('Chat', { bookingId })} haptic="light">
            <View style={styles.chatRow}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={c.gold} />
              <Text style={styles.chatRowText}>Escribir sobre este viaje</Text>
              <Ionicons name="chevron-forward" size={15} color={c.inkFaint} />
            </View>
          </PressableScale>
        ) : null}

        {detail?.vehicle && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Vehículo asignado</Text>
            <View style={styles.vehicleRow}>
              {detail.vehicle.imageUrl ? (
                <Image source={{ uri: detail.vehicle.imageUrl }} style={styles.vehicleImage} resizeMode="cover" />
              ) : (
                <View style={styles.vehicleIcon}>
                  <Ionicons name="car-sport" size={20} color={c.gold} />
                </View>
              )}
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehicleName}>
                  {detail.vehicle.label}
                  {detail.vehicle.year ? ` ${detail.vehicle.year}` : ''}
                </Text>
                <Text style={styles.vehicleMeta}>
                  {[detail.vehicle.color, detail.vehicle.plate].filter(Boolean).join(' · ') ||
                    detail.vehicle.typeName ||
                    'Por asignar'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {(detail?.durationMinutes || detail?.distanceMiles) && (
          <View style={styles.tripMetaRow}>
            {detail.durationMinutes ? <MetaChip icon="time-outline" label={`${detail.durationMinutes} min`} /> : null}
            {detail.distanceMiles ? (
              <MetaChip icon="navigate-outline" label={`${detail.distanceMiles.toFixed(1)} mi`} />
            ) : null}
          </View>
        )}

        <Button label="Compartir viaje" icon="share-social-outline" variant="secondary" onPress={shareTrip} />
      </ScrollView>
    </View>
  )
}

const makeStyles = (c: Palette, shadow: ShadowSet) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, backgroundColor: c.bg, justifyContent: 'center' },
    statusBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.md,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
      backgroundColor: c.bgElevated,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    statusBarLeft: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
    bookingNumber: { color: c.inkFaint, fontFamily: font.bodySemi, fontSize: 12, letterSpacing: 0.3 },
    pickupWrap: { alignItems: 'flex-end' },
    pickupLabel: { color: c.inkFaint, fontFamily: font.body, fontSize: 10 },
    pickupTime: { color: c.ink, fontFamily: font.bodyBold, fontSize: 14 },
    // El mapa ocupa la mitad superior y las tarjetas viven en una hoja
    // desplazable debajo — en el diseño anterior las tarjetas hubieran
    // tapado el mapa o quedado fuera de pantalla en teléfonos chicos.
    map: { flex: 1, minHeight: 220 },
    pin: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#fff' },
    driverMarker: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.gold,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: '#fff',
    },
    sheet: {
      maxHeight: '52%',
      backgroundColor: c.bg,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    sheetContent: { padding: space.lg, gap: space.md },
    waitingBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      backgroundColor: c.surfaceRaised,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: space.lg,
      paddingVertical: space.sm,
    },
    waitingText: { color: c.inkFaint, fontFamily: font.body, fontSize: 12, flexShrink: 1 },
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: space.lg,
      gap: space.md,
      ...shadow.card,
    },
    cardLabel: {
      color: c.inkFaint,
      fontFamily: font.bodySemi,
      fontSize: 10.5,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    driverRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    avatar: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: c.surfaceRaised },
    avatarFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border },
    driverInfo: { flex: 1, gap: 2 },
    driverName: { color: c.ink, fontFamily: font.bodySemi, fontSize: 15 },
    driverMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    driverRating: { color: c.gold, fontFamily: font.bodySemi, fontSize: 12 },
    driverRole: { color: c.inkFaint, fontFamily: font.body, fontSize: 12 },
    driverActions: { flexDirection: 'row', gap: space.sm },
    circleButton: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      backgroundColor: c.goldWash,
      borderWidth: 1,
      borderColor: c.borderGold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chatRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      backgroundColor: c.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
    },
    chatRowText: { flex: 1, color: c.ink, fontFamily: font.bodyMedium, fontSize: 13.5 },
    vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    vehicleIcon: {
      width: 64,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: c.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Landscape, mismo ratio que la miniatura de /admin/fleet — las fotos de
    // tipo de vehículo son apaisadas y un cuadrado las recortaba casi por
    // completo.
    vehicleImage: {
      width: 64,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: c.surfaceRaised,
    },
    vehicleInfo: { flex: 1, gap: 2 },
    vehicleName: { color: c.ink, fontFamily: font.bodySemi, fontSize: 14.5 },
    vehicleMeta: { color: c.inkFaint, fontFamily: font.body, fontSize: 12 },
    tripMetaRow: { flexDirection: 'row', gap: space.lg, paddingHorizontal: space.xs },
  })
