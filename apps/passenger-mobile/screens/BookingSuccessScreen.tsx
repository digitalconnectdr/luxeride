// ── Reserva confirmada ─────────────────────────────────────────────────────
// El momento emocional de la app. El check pasó de verde genérico a dorado
// de marca con halo (el verde competía con el dorado del resto de la app y
// se leía como "operación de sistema completada", no como "tu viaje de lujo
// está reservado"). Debajo del título ahora va el resumen real del viaje —
// antes la pantalla solo mostraba el número de reserva, así que el pasajero
// no tenía forma de verificar que había reservado lo que quería sin salir a
// otra pantalla.

import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, AccessibilityInfo, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Button, MetaChip } from '../components/ui'
import { font, radius, space, useThemedStyles, usePalette, type Palette, type ShadowSet } from '../lib/theme'
import type { BookingStackParamList } from '../lib/types'

type Props = NativeStackScreenProps<BookingStackParamList, 'BookingSuccess'>

export function BookingSuccessScreen({ route, navigation }: Props) {
  const { bookingId, bookingNumber, summary } = route.params
  const styles = useThemedStyles(makeStyles)
  const c = usePalette()

  // Entrada orquestada: el ícono rebota primero, luego el resto del
  // contenido sube con fade. Respeta "reducir movimiento".
  const iconScale = useRef(new Animated.Value(0.6)).current
  const contentOpacity = useRef(new Animated.Value(0)).current
  const contentTranslate = useRef(new Animated.Value(12)).current
  // Latido del halo mientras se busca conductor — señal de "esto sigue
  // pasando ahora mismo", no un adorno.
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    let mounted = true
    let loop: Animated.CompositeAnimation | null = null

    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!mounted) return
      if (reduced) {
        iconScale.setValue(1)
        contentOpacity.setValue(1)
        contentTranslate.setValue(0)
        return
      }
      Animated.sequence([
        Animated.spring(iconScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 10 }),
        Animated.parallel([
          Animated.timing(contentOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.spring(contentTranslate, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 4 }),
        ]),
      ]).start()

      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
        ]),
      )
      loop.start()
    })

    return () => {
      mounted = false
      loop?.stop()
    }
  }, [iconScale, contentOpacity, contentTranslate, pulse])

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] })
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] })

  const date = summary ? new Date(summary.scheduledAt) : null

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.iconStack}>
        <Animated.View
          style={[styles.halo, { transform: [{ scale: haloScale }], opacity: haloOpacity }]}
          pointerEvents="none"
        />
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: iconScale }] }]}>
          <Ionicons name="checkmark" size={38} color={c.onGold} />
        </Animated.View>
      </View>

      <Animated.View
        style={[styles.content, { opacity: contentOpacity, transform: [{ translateY: contentTranslate }] }]}
      >
        <Text style={styles.title}>Reserva confirmada</Text>
        <Text style={styles.number}>{bookingNumber}</Text>
        <Text style={styles.body}>Te avisaremos apenas un conductor sea asignado a tu viaje.</Text>

        {summary && (
          <View style={styles.routeCard}>
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: c.gold }]} />
              <View style={styles.routeTextWrap}>
                <Text style={styles.routeAddress} numberOfLines={2}>
                  {summary.pickupAddress}
                </Text>
                <Text style={styles.routeCaption}>Dirección de recogida</Text>
              </View>
            </View>

            <View style={styles.routeConnector} />

            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: c.danger }]} />
              <View style={styles.routeTextWrap}>
                <Text style={styles.routeAddress} numberOfLines={2}>
                  {summary.dropoffAddress}
                </Text>
                <Text style={styles.routeCaption}>Dirección de destino</Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              {date && (
                <MetaChip
                  icon="calendar-outline"
                  label={`${date.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })} · ${date.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}`}
                />
              )}
              <MetaChip
                icon="people-outline"
                label={`${summary.passengerCount} pasajero${summary.passengerCount === 1 ? '' : 's'}`}
              />
              <MetaChip icon="car-outline" label={summary.vehicleName} />
            </View>
          </View>
        )}

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Estado actual</Text>
          <Text style={styles.statusValue}>Buscando conductor</Text>
          <Text style={styles.statusHint}>Te notificaremos en cuanto sea asignado.</Text>
        </View>

        <Button
          label="Ver seguimiento"
          icon="map-outline"
          onPress={() => navigation.navigate('TripTracking', { bookingId })}
          style={styles.button}
        />
        <Button
          label="Volver al inicio"
          icon="home-outline"
          variant="secondary"
          onPress={() => navigation.popToTop()}
          style={styles.button}
        />
      </Animated.View>
    </ScrollView>
  )
}

const makeStyles = (c: Palette, shadow: ShadowSet) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scroll: { alignItems: 'center', padding: space.xl, paddingTop: space.xxl, paddingBottom: space.xxxl },
    iconStack: { alignItems: 'center', justifyContent: 'center', marginBottom: space.xl },
    halo: {
      position: 'absolute',
      width: 96,
      height: 96,
      borderRadius: radius.pill,
      borderWidth: 2,
      borderColor: c.gold,
    },
    iconWrap: {
      width: 82,
      height: 82,
      borderRadius: radius.pill,
      backgroundColor: c.gold,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow.glow,
    },
    content: { alignItems: 'center', gap: space.md, width: '100%' },
    title: { color: c.ink, fontFamily: font.display, fontSize: 27, textAlign: 'center' },
    number: {
      color: c.gold,
      fontFamily: font.bodyBold,
      fontSize: 15,
      letterSpacing: 0.5,
      backgroundColor: c.goldWash,
      borderWidth: 1,
      borderColor: c.borderGold,
      borderRadius: radius.pill,
      paddingHorizontal: space.lg,
      paddingVertical: 5,
      overflow: 'hidden',
    },
    body: { color: c.inkFaint, fontFamily: font.body, fontSize: 13.5, textAlign: 'center', lineHeight: 20 },
    routeCard: {
      alignSelf: 'stretch',
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: space.lg,
      gap: space.sm,
      marginTop: space.xs,
    },
    routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
    routeDot: { width: 9, height: 9, borderRadius: 4.5, marginTop: 5 },
    // Une los dos puntos de la ruta — sin esto se leen como dos filas
    // sueltas, no como origen → destino de un mismo viaje.
    routeConnector: {
      width: 1,
      height: 14,
      backgroundColor: c.border,
      marginLeft: 4,
      marginVertical: -space.xs,
    },
    routeTextWrap: { flex: 1 },
    routeAddress: { color: c.ink, fontFamily: font.bodyMedium, fontSize: 13.5, lineHeight: 19 },
    routeCaption: { color: c.inkFaint, fontFamily: font.body, fontSize: 11, marginTop: 1 },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space.md,
      paddingTop: space.md,
      marginTop: space.xs,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    statusCard: {
      alignSelf: 'stretch',
      backgroundColor: c.goldWash,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.borderGold,
      padding: space.lg,
      gap: 2,
    },
    statusLabel: {
      color: c.inkFaint,
      fontFamily: font.bodySemi,
      fontSize: 10.5,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    statusValue: { color: c.gold, fontFamily: font.bodyBold, fontSize: 17 },
    statusHint: { color: c.inkFaint, fontFamily: font.body, fontSize: 12 },
    button: { alignSelf: 'stretch' },
  })
