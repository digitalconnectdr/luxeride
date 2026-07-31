// ── Paso 2: selección de vehículo ──────────────────────────────────────────
// Cotiza contra /api/mobile/passenger/quote (wrapper delgado sobre
// getPublicVehicleQuotesAction — mismo motor de precios que la web, sin
// duplicar nada) apenas se entra a la pantalla.

import { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, FlatList, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { callPassengerApi } from '../lib/api'
import { Card, EmptyState, ScreenLoader, MetaChip } from '../components/ui'
import { PressableScale } from '../components/PressableScale'
import { font, radius, space, useThemedStyles, usePalette, type Palette, type ShadowSet } from '../lib/theme'
import type { BookingStackParamList, VehicleQuote } from '../lib/types'

type Props = NativeStackScreenProps<BookingStackParamList, 'VehicleSelect'>

const CLASS_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  sedan: 'car-sport-outline',
  suv: 'car-outline',
  van: 'bus-outline',
  luxury: 'diamond-outline',
}

// Tope fijo de equipaje "extra" cobrable por categoría más allá de la
// capacidad incluida (debe coincidir con MAX_LUGGAGE_EXTRA_PER_CATEGORY en
// apps/web/app/actions/bookings.ts, que es quien realmente lo hace cumplir).
// Aquí, como el equipaje se declara ANTES de elegir vehículo, un vehículo que
// no alcance ni con el tope se marca como insuficiente en vez de dejar que
// el pasajero lo elija y se lleve una sorpresa en la confirmación.
const MAX_LUGGAGE_EXTRA_PER_CATEGORY = 1

export function VehicleSelectScreen({ route, navigation }: Props) {
  const { draft } = route.params
  const styles = useThemedStyles(makeStyles)
  const c = usePalette()
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

  // El mockup destaca una tarjeta con un badge. En vez de un "Más popular"
  // que no podemos sostener con datos (no se lleva registro de qué tipo se
  // reserva más), se destaca la opción MÁS BARATA — eso sí sale del propio
  // resultado de la cotización y le sirve de verdad al pasajero.
  const cheapestId = useMemo(() => {
    if (!quotes || quotes.length < 2) return null
    return quotes.reduce((best, q) => (q.totalAmount < best.totalAmount ? q : best), quotes[0]).vehicleType.id
  }, [quotes])

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
      renderItem={({ item }) => {
        const isCheapest = item.vehicleType.id === cheapestId
        const insufficientCapacity =
          draft.luggageCarryOn    > item.vehicleType.luggageCarryOnCapacity    + MAX_LUGGAGE_EXTRA_PER_CATEGORY ||
          draft.luggageChecked    > item.vehicleType.luggageCheckedCapacity    + MAX_LUGGAGE_EXTRA_PER_CATEGORY ||
          draft.luggageExtraLarge > item.vehicleType.luggageExtraLargeCapacity + MAX_LUGGAGE_EXTRA_PER_CATEGORY
        return (
          <PressableScale
            disabled={insufficientCapacity}
            onPress={() => navigation.navigate('BookingConfirm', { draft, quote: item })}
          >
            <Card style={[styles.card, isCheapest && styles.cardHighlight, insufficientCapacity && styles.cardDisabled]}>
              {isCheapest && !insufficientCapacity && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Mejor precio</Text>
                </View>
              )}

              <View style={styles.topRow}>
                <View style={item.vehicleType.imageUrl ? styles.imageWrap : styles.iconWrap}>
                  {item.vehicleType.imageUrl ? (
                    <Image source={{ uri: item.vehicleType.imageUrl }} style={styles.vehicleImage} resizeMode="cover" />
                  ) : (
                    <Ionicons name={CLASS_ICON[item.vehicleType.class] ?? 'car-outline'} size={22} color={c.gold} />
                  )}
                </View>

                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={2}>
                    {item.vehicleType.name}
                  </Text>
                </View>

                <View style={styles.priceWrap}>
                  <Text style={styles.price}>${item.totalAmount.toFixed(0)}</Text>
                  <Text style={styles.currency}>{item.currency}</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <MetaChip icon="people-outline" label={`${item.vehicleType.capacity} pasajeros`} />
                <MetaChip icon="briefcase-outline" label={`${item.vehicleType.luggageCarryOnCapacity} mano`} />
                <MetaChip icon="briefcase-outline" label={`${item.vehicleType.luggageCheckedCapacity} facturada`} />
                <MetaChip icon="briefcase-outline" label={`${item.vehicleType.luggageExtraLargeCapacity} XL`} />
                {item.durationMinutes ? <MetaChip icon="time-outline" label={`${item.durationMinutes} min`} /> : null}
                {item.distanceMiles ? (
                  <MetaChip icon="navigate-outline" label={`${item.distanceMiles.toFixed(1)} mi`} />
                ) : null}
              </View>

              {insufficientCapacity && (
                <Text style={styles.insufficientText}>
                  Capacidad de equipaje insuficiente para lo que declaraste — elige otro vehículo.
                </Text>
              )}
            </Card>
          </PressableScale>
        )
      }}
    />
  )
}

const makeStyles = (c: Palette, shadow: ShadowSet) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    list: { padding: space.lg, gap: space.md },
    card: { gap: space.md, padding: space.lg, overflow: 'visible' },
    cardHighlight: { borderColor: c.borderGold, borderWidth: 1.5 },
    cardDisabled: { opacity: 0.5 },
    insufficientText: { color: c.danger, fontFamily: font.bodyMedium, fontSize: 11.5, lineHeight: 15 },
    badge: {
      position: 'absolute',
      top: -9,
      right: space.lg,
      backgroundColor: c.gold,
      borderRadius: radius.pill,
      paddingHorizontal: space.md,
      paddingVertical: 3,
      ...shadow.glow,
    },
    badgeText: { color: c.onGold, fontFamily: font.bodySemi, fontSize: 10, letterSpacing: 0.3 },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    iconWrap: {
      width: 76,
      height: 52,
      borderRadius: radius.md,
      backgroundColor: c.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    // Caja horizontal (no cuadrada) para fotos reales de vehículo: las fotos
    // subidas en /admin/fleet son landscape (mismo ratio ~1.45:1 que la
    // miniatura h-11 w-16 de esa página) — un cuadrado con resizeMode="cover"
    // recortaba el vehículo casi por completo.
    imageWrap: {
      width: 88,
      height: 60,
      borderRadius: radius.md,
      backgroundColor: c.surfaceRaised,
      overflow: 'hidden',
    },
    vehicleImage: { width: '100%', height: '100%' },
    info: { flex: 1 },
    name: { color: c.ink, fontFamily: font.bodySemi, fontSize: 15, lineHeight: 20 },
    priceWrap: { alignItems: 'flex-end' },
    price: { color: c.ink, fontFamily: font.bodyBold, fontSize: 22 },
    currency: { color: c.inkFaint, fontFamily: font.bodyMedium, fontSize: 10.5, marginTop: -2 },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space.md,
      paddingTop: space.md,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
  })
