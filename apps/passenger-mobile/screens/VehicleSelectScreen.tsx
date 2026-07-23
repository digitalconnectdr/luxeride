// ── Paso 2: selección de vehículo ──────────────────────────────────────────
// Cotiza contra /api/mobile/passenger/quote (wrapper delgado sobre
// getPublicVehicleQuotesAction — mismo motor de precios que la web, sin
// duplicar nada) apenas se entra a la pantalla.

import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { callPassengerApi } from '../lib/api'
import { Card, EmptyState, ScreenLoader } from '../components/ui'
import { PressableScale } from '../components/PressableScale'
import { color, font, radius, space, shadow } from '../lib/theme'
import type { BookingStackParamList, VehicleQuote } from '../lib/types'

type Props = NativeStackScreenProps<BookingStackParamList, 'VehicleSelect'>

const CLASS_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  sedan: 'car-sport-outline',
  suv: 'car-outline',
  van: 'bus-outline',
  luxury: 'diamond-outline',
}

export function VehicleSelectScreen({ route, navigation }: Props) {
  const { draft } = route.params
  const [quotes, setQuotes] = useState<VehicleQuote[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const companySlug = process.env.EXPO_PUBLIC_COMPANY_SLUG ?? ''
      const result = await callPassengerApi<{ data?: VehicleQuote[] }>('quote', {
        companySlug,
        pickupLat: draft.pickupLat,
        pickupLng: draft.pickupLng,
        pickupAddress: draft.pickupAddress,
        pickupPostalCode: draft.pickupPostalCode,
        dropoffLat: draft.dropoffLat,
        dropoffLng: draft.dropoffLng,
        dropoffAddress: draft.dropoffAddress,
        dropoffPostalCode: draft.dropoffPostalCode,
        scheduledAt: draft.scheduledAt,
      })
      if (cancelled) return
      if (!result.success || !result.data) {
        setError(result.error ?? 'No se pudieron cargar los vehículos')
        return
      }
      setQuotes(result.data.filter((q) => !q.noPrice))
    }
    load()
    return () => {
      cancelled = true
    }
  }, [draft])

  if (!quotes && !error) return <ScreenLoader />

  if (error) {
    return (
      <View style={styles.container}>
        <EmptyState icon="alert-circle-outline" title="No se pudo cotizar" subtitle={error} />
      </View>
    )
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      data={quotes}
      keyExtractor={(item) => item.vehicleType.id}
      ListEmptyComponent={
        <EmptyState icon="car-outline" title="No hay vehículos disponibles" subtitle="Intenta con otro horario" />
      }
      renderItem={({ item }) => (
        <PressableScale onPress={() => navigation.navigate('BookingConfirm', { draft, quote: item })}>
          <Card style={styles.card}>
            <View style={styles.iconWrap}>
              {item.vehicleType.imageUrl ? (
                <Image source={{ uri: item.vehicleType.imageUrl }} style={styles.vehicleImage} resizeMode="cover" />
              ) : (
                <Ionicons name={CLASS_ICON[item.vehicleType.class] ?? 'car-outline'} size={22} color={color.gold} />
              )}
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.vehicleType.name}</Text>
              <Text style={styles.meta}>
                {item.vehicleType.capacity} pasajeros
                {item.durationMinutes ? ` · ${item.durationMinutes} min` : ''}
                {item.distanceMiles ? ` · ${item.distanceMiles.toFixed(1)} mi` : ''}
              </Text>
            </View>
            <Text style={styles.price}>${item.totalAmount.toFixed(0)}</Text>
          </Card>
        </PressableScale>
      )}
    />
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  list: { padding: space.lg, gap: space.md },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: color.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadow.card,
  },
  vehicleImage: { width: '100%', height: '100%' },
  info: { flex: 1, gap: 2 },
  name: { color: color.ink, fontFamily: font.bodySemi, fontSize: 15 },
  meta: { color: color.inkFaint, fontFamily: font.body, fontSize: 12 },
  price: { color: color.ink, fontFamily: font.displaySemi, fontSize: 20 },
})
