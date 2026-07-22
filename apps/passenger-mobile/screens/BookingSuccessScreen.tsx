import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Button } from '../components/ui'
import { color, font, radius, space } from '../lib/theme'
import type { BookingStackParamList } from '../lib/types'

type Props = NativeStackScreenProps<BookingStackParamList, 'BookingSuccess'>

export function BookingSuccessScreen({ route, navigation }: Props) {
  const { bookingNumber } = route.params

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="checkmark" size={36} color="#fff" />
      </View>
      <Text style={styles.title}>Reserva confirmada</Text>
      <Text style={styles.number}>{bookingNumber}</Text>
      <Text style={styles.body}>Te avisaremos apenas un conductor sea asignado a tu viaje.</Text>
      <Button
        label="Volver al inicio"
        onPress={() => navigation.popToTop()}
        style={styles.button}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: color.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  title: { color: color.ink, fontFamily: font.display, fontSize: 24 },
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
  button: { alignSelf: 'stretch', marginTop: space.xl },
})
