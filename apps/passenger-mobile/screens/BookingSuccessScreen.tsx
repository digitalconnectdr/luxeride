import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, AccessibilityInfo } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Button } from '../components/ui'
import { color, font, radius, space } from '../lib/theme'
import type { BookingStackParamList } from '../lib/types'

type Props = NativeStackScreenProps<BookingStackParamList, 'BookingSuccess'>

export function BookingSuccessScreen({ route, navigation }: Props) {
  const { bookingId, bookingNumber } = route.params

  // Momento emocional de la app (reserva confirmada) — antes aparecía todo
  // de golpe, sin ningún énfasis. Entrada orquestada: el ícono rebota primero,
  // luego el resto del contenido sube con fade. Respeta "reducir movimiento".
  const iconScale = useRef(new Animated.Value(0.6)).current
  const contentOpacity = useRef(new Animated.Value(0)).current
  const contentTranslate = useRef(new Animated.Value(12)).current

  useEffect(() => {
    let mounted = true
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
    })
    return () => {
      mounted = false
    }
  }, [iconScale, contentOpacity, contentTranslate])

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.iconWrap, { transform: [{ scale: iconScale }] }]}>
        <Ionicons name="checkmark" size={36} color="#fff" />
      </Animated.View>

      <Animated.View
        style={[styles.content, { opacity: contentOpacity, transform: [{ translateY: contentTranslate }] }]}
      >
        <Text style={styles.title}>Reserva confirmada</Text>
        <Text style={styles.number}>{bookingNumber}</Text>
        <Text style={styles.body}>Te avisaremos apenas un conductor sea asignado a tu viaje.</Text>
        <Button
          label="Ver mi viaje"
          icon="map-outline"
          onPress={() => navigation.navigate('TripTracking', { bookingId })}
          style={styles.button}
        />
        <Button
          label="Volver al inicio"
          variant="secondary"
          onPress={() => navigation.popToTop()}
          style={styles.button}
        />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  content: { alignItems: 'center', gap: space.md, width: '100%' },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    backgroundColor: color.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
    shadowColor: color.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 6,
  },
  title: { color: color.ink, fontFamily: font.display, fontSize: 26 },
  number: {
    color: color.gold,
    fontFamily: font.bodyBold,
    fontSize: 16,
    backgroundColor: color.warningSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
  },
  body: { color: color.inkFaint, fontFamily: font.body, fontSize: 14, textAlign: 'center', marginTop: space.sm },
  button: { alignSelf: 'stretch', marginTop: space.xs },
})
