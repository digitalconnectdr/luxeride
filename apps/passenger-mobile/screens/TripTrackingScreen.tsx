// ── Seguimiento en tiempo real del conductor ────────────────────────────────
// Lee la reserva directo por Supabase (RLS customers_select_own_bookings,
// ya existente) y se suscribe a trip_locations por Realtime — el pasajero
// autenticado SÍ puede leer payload.new directo (RLS
// customers_select_own_trip_locations, migración 62), a diferencia del
// guest anónimo de la web que necesita un side-channel de refetch vía
// server action. Mismo patrón de canal que
// apps/driver-mobile/screens/ChatScreen.tsx.
//
// Requiere una API key nativa de Google Maps para Android (ver
// .env.example) — sin ella, react-native-maps no renderiza el mapa, pero
// el resto de la pantalla (estado del viaje) sigue funcionando.

import { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { supabase } from '../lib/supabase'
import { decodePolyline, type LatLng } from '../lib/polyline'
import { ScreenLoader, StatusBadge, EmptyState } from '../components/ui'
import { color, space } from '../lib/theme'
import type { BookingStackParamList, BookingStatus } from '../lib/types'

type Props = NativeStackScreenProps<BookingStackParamList, 'TripTracking'>

interface TripBooking {
  status: BookingStatus
  pickup: { address?: string; lat?: number; lng?: number } | null
  dropoff: { address?: string; lat?: number; lng?: number } | null
  routePolyline: string | null
}

export function TripTrackingScreen({ route }: Props) {
  const { bookingId } = route.params
  const [booking, setBooking] = useState<TripBooking | null>(null)
  const [driverPos, setDriverPos] = useState<LatLng | null>(null)
  const [loadError, setLoadError] = useState('')
  const mapRef = useRef<MapView>(null)
  const fitDone = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('bookings')
        .select('status, pickup_location, dropoff_location, route_polyline')
        .eq('id', bookingId)
        .single()
      if (cancelled) return
      if (error || !data) {
        setLoadError('No pudimos cargar tu viaje')
        return
      }
      setBooking({
        status: data.status as BookingStatus,
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

  return (
    <View style={styles.container}>
      <View style={styles.statusBar}>
        <StatusBadge status={booking.status} />
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        onMapReady={fitMapToTrip}
        onLayout={fitMapToTrip}
      >
        {routeCoords.length > 0 && <Polyline coordinates={routeCoords} strokeColor={color.gold} strokeWidth={4} />}
        {pickupCoord && (
          <Marker coordinate={pickupCoord} title="Origen" pinColor={color.gold}>
            <View style={[styles.pin, { backgroundColor: color.gold }]} />
          </Marker>
        )}
        {dropoffCoord && (
          <Marker coordinate={dropoffCoord} title="Destino">
            <View style={[styles.pin, { backgroundColor: color.danger }]} />
          </Marker>
        )}
        {driverPos && (
          <Marker coordinate={driverPos} title="Tu conductor" onPress={fitMapToTrip}>
            <View style={styles.driverMarker}>
              <Ionicons name="car-sport" size={18} color="#fff" />
            </View>
          </Marker>
        )}
      </MapView>

      {!driverPos && (
        <View style={styles.waitingBanner}>
          <Ionicons name="time-outline" size={16} color={color.inkFaint} />
          <Text style={styles.waitingText}>Esperando la ubicación de tu conductor…</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  center: { flex: 1, backgroundColor: color.bg, justifyContent: 'center' },
  statusBar: { padding: space.lg, backgroundColor: color.bgElevated, borderBottomWidth: 1, borderBottomColor: color.border },
  map: { flex: 1 },
  pin: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#fff' },
  driverMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  waitingBanner: {
    position: 'absolute',
    bottom: space.xl,
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: color.bgElevated,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  waitingText: { color: color.inkFaint, fontSize: 12 },
})
