// ── Inicio — pantalla de bienvenida ────────────────────────────────────────
// Antes, al iniciar sesión, el pasajero caía directo en "Reservar" sin
// ningún momento que presentara la marca de la empresa — se sentía como
// entrar a mitad de una tarea, no como abrir la app. Esta pantalla es la
// primera pestaña: saluda, muestra la marca, y si hay un viaje activo/
// próximo lo destaca antes que nada.

import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useBranding } from '../lib/branding'
import { BrandMark } from '../components/BrandMark'
import { PressableScale } from '../components/PressableScale'
import { Button, Card, StatusBadge } from '../components/ui'
import { color, font, radius, space } from '../lib/theme'
import type { BookingStatus } from '../lib/types'

const ACTIVE_STATUSES: BookingStatus[] = ['pending', 'assigned', 'en_route', 'arrived', 'in_progress']

interface UpcomingTrip {
  id: string
  booking_number: string
  status: BookingStatus
  scheduled_at: string
  pickup_location: { address?: string } | null
  dropoff_location: { address?: string } | null
}

export function HomeScreen() {
  // any: esta pantalla vive en el Tab.Navigator raíz — navegar a pantallas de
  // OTRA pestaña (Reservar/Mis viajes/Perfil) no tiene un tipo compartido,
  // mismo patrón ya usado en MyTripsScreen.
  const navigation = useNavigation<any>()
  const { branding } = useBranding()
  const [firstName, setFirstName] = useState('')
  const [upcoming, setUpcoming] = useState<UpcomingTrip | null>(null)

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('first_name')
      .eq('id', auth.user.id)
      .single()
    if (profile) setFirstName(profile.first_name ?? '')

    const { data: trips } = await supabase
      .from('bookings')
      .select('id, booking_number, status, scheduled_at, pickup_location, dropoff_location')
      .in('status', ACTIVE_STATUSES)
      .order('scheduled_at', { ascending: true })
      .limit(1)
    setUpcoming((trips?.[0] as UpcomingTrip) ?? null)
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.hero}>
        <BrandMark size={72} />
        <Text style={styles.greeting}>Hola{firstName ? `, ${firstName}` : ''}</Text>
        <Text style={styles.subtitle}>Viajando con {branding.name}</Text>
      </View>

      {upcoming && (
        <PressableScale
          onPress={() =>
            navigation.navigate('Reservar', { screen: 'TripTracking', params: { bookingId: upcoming.id } })
          }
        >
          <Card style={styles.upcomingCard}>
            <View style={styles.upcomingHeader}>
              <Text style={styles.upcomingLabel}>Tu próximo viaje</Text>
              <StatusBadge status={upcoming.status} />
            </View>
            <Text style={styles.upcomingNumber}>{upcoming.booking_number}</Text>
            <Text style={styles.upcomingAddress} numberOfLines={1}>
              {upcoming.pickup_location?.address ?? 'Origen'} → {upcoming.dropoff_location?.address ?? 'Destino'}
            </Text>
            <View style={styles.upcomingCta}>
              <Text style={styles.upcomingCtaText}>Ver en vivo</Text>
              <Ionicons name="arrow-forward" size={14} color={color.gold} />
            </View>
          </Card>
        </PressableScale>
      )}

      <Button
        label="Reservar un viaje"
        icon="car-sport"
        onPress={() => navigation.navigate('Reservar', { screen: 'NewBooking' })}
        style={styles.mainCta}
      />

      <View style={styles.quickRow}>
        <PressableScale onPress={() => navigation.navigate('Mis viajes')} style={styles.quickItem}>
          <View style={styles.quickCard}>
            <Ionicons name="time-outline" size={22} color={color.gold} />
            <Text style={styles.quickText}>Mis viajes</Text>
          </View>
        </PressableScale>
        <PressableScale onPress={() => navigation.navigate('Perfil')} style={styles.quickItem}>
          <View style={styles.quickCard}>
            <Ionicons name="person-outline" size={22} color={color.gold} />
            <Text style={styles.quickText}>Perfil</Text>
          </View>
        </PressableScale>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  scroll: { padding: space.lg, gap: space.lg, paddingTop: space.xxl },
  hero: { alignItems: 'center', gap: space.sm, paddingBottom: space.sm },
  greeting: { color: color.ink, fontFamily: font.display, fontSize: 26, marginTop: space.sm },
  subtitle: { color: color.inkFaint, fontFamily: font.body, fontSize: 13 },
  upcomingCard: { gap: 4 },
  upcomingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  upcomingLabel: {
    color: color.inkFaint,
    fontFamily: font.bodySemi,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  upcomingNumber: { color: color.ink, fontFamily: font.bodyBold, fontSize: 16, marginTop: 4 },
  upcomingAddress: { color: color.inkFaint, fontFamily: font.body, fontSize: 13 },
  upcomingCta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: space.xs },
  upcomingCtaText: { color: color.gold, fontFamily: font.bodySemi, fontSize: 12 },
  mainCta: { marginTop: space.xs },
  quickRow: { flexDirection: 'row', gap: space.md },
  quickItem: { flex: 1 },
  quickCard: {
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  quickText: { color: color.ink, fontFamily: font.bodyMedium, fontSize: 13 },
})
