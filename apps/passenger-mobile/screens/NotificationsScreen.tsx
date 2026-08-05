// ── Centro de notificaciones del pasajero ──────────────────────────────────
// El push nativo es efímero: si el pasajero lo descarta, o el teléfono estaba
// apagado cuando el conductor salió, ese aviso se perdía para siempre. Aquí
// queda el historial de 30 días.
//
// Los avisos los genera el servidor (ver lib/notifications/passenger-feed.ts
// en apps/web) en los mismos momentos en que ya se mandaba push: conductor
// asignado / en camino / llegó, viaje completado o cancelado, y los
// recordatorios de viaje próximo del cron.

import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { callPassengerApi } from '../lib/api'
import { EmptyState, Skeleton } from '../components/ui'
import { PressableScale } from '../components/PressableScale'
import { font, radius, space, useThemedStyles, usePalette, type Palette } from '../lib/theme'

interface NotificationItem {
  id: string
  type: string
  title: string
  body: string | null
  bookingId: string | null
  createdAt: string
  isNew: boolean
}

/** Icono por tipo — el aviso se reconoce antes de leerlo. */
const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  driver_assigned: 'person-circle-outline',
  driver_en_route: 'car-sport-outline',
  driver_arrived: 'location-outline',
  trip_completed: 'checkmark-circle-outline',
  booking_cancelled: 'close-circle-outline',
  booking_reminder: 'alarm-outline',
  reengagement: 'sparkles-outline',
  chat_message: 'chatbubble-ellipses-outline',
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60_000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `Hace ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.round(hours / 24)
  if (days < 7) return `Hace ${days} d`
  return new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })
}

// Título (barra media, el dato que el ojo busca primero al escanear la
// lista) sobre cuerpo (barra angosta, secundario) sobre hora (la más chica
// de las 3) — la misma jerarquía título/cuerpo/hora del renderItem real.
function NotificationSkeleton() {
  const styles = useThemedStyles(makeStyles)
  return (
    <View style={styles.card}>
      <Skeleton width={38} height={38} radius={999} />
      <View style={styles.textWrap}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="85%" height={12.5} style={{ marginTop: 5 }} />
        <Skeleton width={50} height={11} style={{ marginTop: 5 }} />
      </View>
    </View>
  )
}

export function NotificationsScreen() {
  const navigation = useNavigation<any>()
  const styles = useThemedStyles(makeStyles)
  const c = usePalette()
  const [items, setItems] = useState<NotificationItem[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // markSeen en la MISMA llamada que trae la lista: el servidor calcula
  // isNew antes de mover la marca de agua, así que esta carga todavía
  // distingue lo nuevo y la siguiente ya no.
  const load = useCallback(async (markSeen: boolean) => {
    const result = await callPassengerApi<{ items?: NotificationItem[] }>('notifications', { markSeen })
    if (result.success && result.items) setItems(result.items)
    else setItems([])
  }, [])

  useFocusEffect(
    useCallback(() => {
      load(true)
    }, [load]),
  )

  async function onRefresh() {
    setRefreshing(true)
    await load(false)
    setRefreshing(false)
  }

  if (!items) {
    return (
      <View style={styles.container}>
        <View style={styles.list}>
          <NotificationSkeleton />
          <NotificationSkeleton />
          <NotificationSkeleton />
          <NotificationSkeleton />
        </View>
      </View>
    )
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.gold} />}
      ListEmptyComponent={
        <EmptyState
          icon="notifications-outline"
          title="Sin notificaciones"
          subtitle="Aquí verás los avisos de tus viajes: cuando se asigne un conductor, cuando vaya en camino y los recordatorios."
        />
      }
      renderItem={({ item }) => {
        const canOpen = Boolean(item.bookingId)
        const row = (
          <View style={[styles.card, item.isNew && styles.cardNew]}>
            <View style={[styles.iconWrap, item.isNew && styles.iconWrapNew]}>
              <Ionicons
                name={TYPE_ICON[item.type] ?? 'notifications-outline'}
                size={18}
                color={item.isNew ? c.gold : c.inkFaint}
              />
            </View>
            <View style={styles.textWrap}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, item.isNew && styles.titleNew]} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.isNew && <View style={styles.newDot} />}
              </View>
              {item.body ? (
                <Text style={styles.body} numberOfLines={2}>
                  {item.body}
                </Text>
              ) : null}
              <Text style={styles.time}>{relativeTime(item.createdAt)}</Text>
            </View>
            {canOpen && <Ionicons name="chevron-forward" size={15} color={c.inkFaint} />}
          </View>
        )

        if (!canOpen) return row
        return (
          <PressableScale
            onPress={() =>
              navigation.navigate('Reservar', { screen: 'TripTracking', params: { bookingId: item.bookingId } })
            }
          >
            {row}
          </PressableScale>
        )
      }}
    />
  )
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    list: { padding: space.lg, gap: space.sm },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.md,
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: space.lg,
    },
    cardNew: { borderColor: c.borderGold, backgroundColor: c.goldWash },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: radius.pill,
      backgroundColor: c.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrapNew: { backgroundColor: c.goldWash, borderWidth: 1, borderColor: c.borderGold },
    textWrap: { flex: 1, gap: 2 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    title: { flex: 1, color: c.ink, fontFamily: font.bodyMedium, fontSize: 14 },
    titleNew: { fontFamily: font.bodySemi },
    newDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.gold },
    body: { color: c.inkMuted, fontFamily: font.body, fontSize: 12.5, lineHeight: 18 },
    time: { color: c.inkFaint, fontFamily: font.body, fontSize: 11, marginTop: 2 },
  })
