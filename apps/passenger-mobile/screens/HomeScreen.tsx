// ── Inicio — pantalla de bienvenida ────────────────────────────────────────
// Antes, al iniciar sesión, el pasajero caía directo en "Reservar" sin
// ningún momento que presentara la marca de la empresa — se sentía como
// entrar a mitad de una tarea, no como abrir la app. Esta pantalla es la
// primera pestaña: saluda, muestra la marca, y si hay un viaje activo/
// próximo lo destaca antes que nada.
//
// El saludo va alineado a la izquierda (antes centrado): el mockup de
// referencia trata esta pantalla como un panel personal, no como una
// portada, y el bloque centrado empujaba todo lo accionable hacia abajo.

import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { callPassengerApi } from '../lib/api'
import { useBranding } from '../lib/branding'
import { BrandMark } from '../components/BrandMark'
import { PressableScale } from '../components/PressableScale'
import { Button, Card, StatusBadge } from '../components/ui'
import { font, radius, space, useThemedStyles, useTheme, type Palette, type ShadowSet } from '../lib/theme'
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
  const styles = useThemedStyles(makeStyles)
  const { c, mode, setMode } = useTheme()
  const [firstName, setFirstName] = useState('')
  const [upcoming, setUpcoming] = useState<UpcomingTrip | null>(null)
  const [upcomingCount, setUpcomingCount] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)

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
    const list = (trips ?? []) as UpcomingTrip[]
    setUpcoming(list[0] ?? null)
    setUpcomingCount(list.length)

    // markSeen:false — abrir Inicio no cuenta como haber leído los avisos;
    // eso pasa solo al entrar al centro de notificaciones.
    const notif = await callPassengerApi<{ unreadCount?: number }>('notifications', { markSeen: false })
    if (notif.success) setUnreadCount(notif.unreadCount ?? 0)
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  // El tema se alterna entre claro y oscuro explícitos; "seguir al sistema"
  // vive en Perfil, donde hay espacio para explicar qué hace cada opción.
  function toggleTheme() {
    setMode(c.mode === 'dark' ? 'light' : 'dark')
  }

  const upcomingDate = upcoming ? new Date(upcoming.scheduled_at) : null

  return (
    <View style={styles.container}>
      {/* Cabecera de marca: logo a la izquierda; a la derecha, cambio rápido
      de tema y la campana de notificaciones con su contador de no leídos. */}
      <View style={styles.topBar}>
        <BrandMark size={38} />
        <View style={styles.topBarSpacer} />
        <PressableScale onPress={toggleTheme} hitSlop={10} haptic="light">
          <View style={styles.iconButton}>
            <Ionicons name={c.mode === 'dark' ? 'sunny-outline' : 'moon-outline'} size={18} color={c.gold} />
          </View>
        </PressableScale>
        <PressableScale onPress={() => navigation.navigate('Notifications')} hitSlop={10} haptic="light">
          <View style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={18} color={c.gold} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </View>
        </PressableScale>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.greeting}>Hola{firstName ? `, ${firstName}` : ''}</Text>
          <Text style={styles.brandLine}>Viajando con {branding.name}</Text>
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
              <Text style={styles.upcomingAddress} numberOfLines={2}>
                {upcoming.pickup_location?.address ?? 'Origen'} → {upcoming.dropoff_location?.address ?? 'Destino'}
              </Text>
              {upcomingDate && (
                <Text style={styles.upcomingDate}>
                  {upcomingDate.toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })} ·{' '}
                  {upcomingDate.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
              <View style={styles.upcomingCta}>
                <Text style={styles.upcomingCtaText}>Ver en vivo</Text>
                <Ionicons name="arrow-forward" size={14} color={c.gold} />
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
              <Ionicons name="time-outline" size={20} color={c.gold} />
              <Text style={styles.quickText}>Mis viajes</Text>
              <Text style={styles.quickSubtext}>
                {upcomingCount > 0
                  ? `${upcomingCount} próximo${upcomingCount === 1 ? '' : 's'}`
                  : 'Ver historial'}
              </Text>
            </View>
          </PressableScale>
          <PressableScale onPress={() => navigation.navigate('Perfil')} style={styles.quickItem}>
            <View style={styles.quickCard}>
              <Ionicons name="person-outline" size={20} color={c.gold} />
              <Text style={styles.quickText}>Perfil</Text>
              <Text style={styles.quickSubtext}>Ver y editar</Text>
            </View>
          </PressableScale>
        </View>
      </ScrollView>
    </View>
  )
}

const makeStyles = (c: Palette, shadow: ShadowSet) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scrollView: { flex: 1 },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: space.lg,
      paddingTop: space.xxl + space.md,
      paddingBottom: space.md,
      backgroundColor: c.bg,
    },
    topBarSpacer: { flex: 1 },
    iconButton: {
      width: 38,
      height: 38,
      borderRadius: radius.pill,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: space.sm,
      // overflow visible para que el badge pueda sobresalir del círculo.
      overflow: 'visible',
    },
    badge: {
      position: 'absolute',
      top: -3,
      right: -3,
      minWidth: 17,
      height: 17,
      borderRadius: radius.pill,
      backgroundColor: c.danger,
      borderWidth: 1.5,
      borderColor: c.bg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    badgeText: { color: '#fff', fontFamily: font.bodyBold, fontSize: 9.5 },
    scroll: { padding: space.lg, gap: space.lg, paddingTop: space.sm },
    hero: { gap: 2 },
    greeting: { color: c.ink, fontFamily: font.display, fontSize: 30 },
    brandLine: { color: c.gold, fontFamily: font.bodyMedium, fontSize: 13 },
    upcomingCard: { gap: 4, ...shadow.card },
    upcomingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
    upcomingLabel: {
      color: c.inkFaint,
      fontFamily: font.bodySemi,
      fontSize: 10.5,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
    },
    upcomingNumber: { color: c.ink, fontFamily: font.bodyBold, fontSize: 18, marginTop: 6 },
    upcomingAddress: { color: c.inkMuted, fontFamily: font.body, fontSize: 13, lineHeight: 19 },
    upcomingDate: { color: c.inkFaint, fontFamily: font.bodyMedium, fontSize: 12, marginTop: 2 },
    upcomingCta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: space.sm },
    upcomingCtaText: { color: c.gold, fontFamily: font.bodySemi, fontSize: 12.5 },
    mainCta: { marginTop: space.xs },
    quickRow: { flexDirection: 'row', gap: space.md },
    quickItem: { flex: 1 },
    quickCard: {
      gap: 3,
      paddingVertical: space.lg,
      paddingHorizontal: space.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    quickText: { color: c.ink, fontFamily: font.bodySemi, fontSize: 13.5, marginTop: 2 },
    quickSubtext: { color: c.inkFaint, fontFamily: font.body, fontSize: 11.5 },
  })
