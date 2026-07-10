import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { callDriverApi } from '../lib/api'
import { PressableScale } from '../components/PressableScale'
import { Button, Card, ScreenLoader, SectionLabel } from '../components/ui'
import { color, font, radius, space } from '../lib/theme'
import type { TripsStackParamList } from '../lib/types'

interface AffiliateTripDetail {
  id: string
  status: 'accepted' | 'en_route' | 'arrived' | 'in_progress' | 'completed'
  booking_number?: string
  passenger_name?: string | null
  passenger_phone?: string | null
  pickup_location?: { address?: string } | null
  dropoff_location?: { address?: string } | null
  flight_number?: string | null
}

const STATUS_LABEL: Record<string, string> = {
  accepted: 'Asignado',
  en_route: 'En ruta al pickup',
  arrived: 'En el punto de recogida',
  in_progress: 'Viaje en curso',
  completed: 'Completado',
}

const NEXT_ACTION_LABEL: Record<string, string> = {
  accepted: 'Ir al punto de recogida',
  en_route: 'Marcar como llegué',
  arrived: 'Iniciar viaje',
  in_progress: 'Completar viaje',
}

const ACTION_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  accepted: 'navigate',
  en_route: 'flag',
  arrived: 'play',
  in_progress: 'checkmark-done',
}

function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}
function wazeUrl(address: string) {
  return `https://www.waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`
}
function whatsappUrl(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, '')}`
}

type Props = NativeStackScreenProps<TripsStackParamList, 'AffiliateTripDetail'>

export function AffiliateTripDetailScreen({ route, navigation }: Props) {
  const { affiliateTripId } = route.params
  const [trip, setTrip] = useState<AffiliateTripDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [advancing, setAdvancing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const result = await callDriverApi<{ trip?: AffiliateTripDetail }>('affiliate-trip-detail', { affiliateTripId })
    setTrip(result.trip ?? null)
    setLoading(false)
  }, [affiliateTripId])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  async function advance() {
    if (!trip) return
    setAdvancing(true)
    setError('')
    const result = await callDriverApi('advance-affiliate-trip', { affiliateTripId })
    setAdvancing(false)
    if (!result.success) setError(result.error ?? 'No se pudo actualizar el viaje')
    else if (trip.status === 'in_progress') navigation.goBack()
    else await load()
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
      <View style={styles.affiliateNotice}>
        <Ionicons name="git-network-outline" size={14} color={color.gold} />
        <Text style={styles.affiliateNoticeText}>Viaje de la Red de Afiliados</Text>
      </View>

      <Card>
        <View style={styles.topRow}>
          <Text style={styles.bookingNumber}>{trip.booking_number ?? '—'}</Text>
          <Text style={styles.statusLabel} numberOfLines={1}>
            {STATUS_LABEL[trip.status] ?? trip.status}
          </Text>
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
            <PressableScale style={styles.contactButton} onPress={() => Linking.openURL(whatsappUrl(trip.passenger_phone!))}>
              <Ionicons name="logo-whatsapp" size={16} color={color.success} />
              <Text style={styles.contactButtonText}>WhatsApp</Text>
            </PressableScale>
          </View>
        )}
      </Card>

      <Card>
        <SectionLabel>Ruta</SectionLabel>
        <View style={styles.routeBlock}>
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

          <Text style={[styles.routeLabel, styles.routeLabelSpaced]}>Destino</Text>
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
      </Card>

      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={16} color={color.danger} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}

      {NEXT_ACTION_LABEL[trip.status] && (
        <Button
          label={NEXT_ACTION_LABEL[trip.status]}
          icon={ACTION_ICON[trip.status]}
          onPress={advance}
          loading={advancing}
          haptic="medium"
        />
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  content: { padding: space.xl, gap: space.md, flexGrow: 1 },
  center: { flex: 1, backgroundColor: color.bg, justifyContent: 'center', alignItems: 'center', gap: space.sm },
  emptyText: { color: color.inkFaint, fontFamily: font.body, fontSize: 14 },
  affiliateNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    alignSelf: 'flex-start',
    backgroundColor: `${color.gold}18`,
    borderWidth: 1,
    borderColor: `${color.gold}55`,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  affiliateNoticeText: { color: color.gold, fontFamily: font.bodySemi, fontSize: 11, letterSpacing: 0.5 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  bookingNumber: { color: color.inkFaint, fontFamily: font.bodySemi, fontSize: 12, letterSpacing: 1, flexShrink: 0 },
  statusLabel: { color: color.gold, fontFamily: font.bodySemi, fontSize: 13, flexShrink: 1, textAlign: 'right' },
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
  routeLabel: { color: color.inkFaint, fontFamily: font.bodySemi, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
  routeLabelSpaced: { marginTop: space.lg },
  routeAddress: { color: color.ink, fontFamily: font.body, fontSize: 14, marginTop: 4, lineHeight: 19 },
  navRow: { flexDirection: 'row', gap: space.lg, marginTop: space.sm },
  navButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10, paddingHorizontal: 2 },
  navButtonText: { color: color.gold, fontFamily: font.bodySemi, fontSize: 12 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs },
  error: { color: color.danger, fontFamily: font.bodyMedium, fontSize: 13, flexShrink: 1 },
})
