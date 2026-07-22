// ── Paso 3: confirmar reserva ───────────────────────────────────────────────
// Sin cobro todavía (Sprint 3 — pago vía Whop, mismo proveedor que ya usa el
// resto de la plataforma, NO Stripe; ver getSavedWhopCardAction /
// chargeWithSavedWhopCardAction en apps/web/app/actions/payments.ts como
// referencia). El operador cobra manualmente por ahora, igual que ya
// soporta el sistema con pagos cash/Zelle/transferencia.

import { useEffect, useState } from 'react'
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { supabase } from '../lib/supabase'
import { callPassengerApi } from '../lib/api'
import { Button, Card, SectionLabel } from '../components/ui'
import { color, font, space } from '../lib/theme'
import type { BookingStackParamList } from '../lib/types'

type Props = NativeStackScreenProps<BookingStackParamList, 'BookingConfirm'>

function row(label: string, value: string) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

export function BookingConfirmScreen({ route, navigation }: Props) {
  const { draft, quote } = route.params
  const [passengerName, setPassengerName] = useState('')
  const [passengerPhone, setPassengerPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function prefill() {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, phone')
        .eq('id', auth.user.id)
        .single()
      if (profile) {
        setPassengerName(`${profile.first_name} ${profile.last_name}`.trim())
        setPassengerPhone(profile.phone ?? '')
      }
    }
    prefill()
  }, [])

  async function confirm() {
    setError('')
    if (!passengerName.trim() || !passengerPhone.trim()) {
      setError('Nombre y teléfono son requeridos')
      return
    }
    setLoading(true)
    const companySlug = process.env.EXPO_PUBLIC_COMPANY_SLUG ?? ''
    const result = await callPassengerApi<{ data?: { bookingNumber: string } }>('book', {
      quoteId: quote.quoteId,
      companySlug,
      passengerName: passengerName.trim(),
      passengerPhone: passengerPhone.trim(),
      passengerCount: draft.passengerCount,
      scheduledAt: draft.scheduledAt,
      pickupAddress: draft.pickupAddress,
      pickupLat: draft.pickupLat,
      pickupLng: draft.pickupLng,
      dropoffAddress: draft.dropoffAddress,
      dropoffLat: draft.dropoffLat,
      dropoffLng: draft.dropoffLng,
    })
    setLoading(false)
    if (!result.success || !result.data) {
      setError(result.error ?? 'No se pudo crear la reserva')
      return
    }
    navigation.replace('BookingSuccess', { bookingNumber: result.data.bookingNumber })
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Card>
        <SectionLabel>Resumen del viaje</SectionLabel>
        <View style={styles.divider} />
        {row('Vehículo', quote.vehicleType.name)}
        {row('Origen', draft.pickupAddress)}
        {row('Destino', draft.dropoffAddress)}
        {row('Fecha', new Date(draft.scheduledAt).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' }))}
        {row('Pasajeros', String(draft.passengerCount))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total estimado</Text>
          <Text style={styles.totalValue}>${quote.totalAmount.toFixed(2)} {quote.currency}</Text>
        </View>
      </Card>

      <Card style={styles.section}>
        <SectionLabel>Datos del pasajero</SectionLabel>
        <View style={styles.inputWrap}>
          <Ionicons name="person-outline" size={18} color={color.inkFaint} />
          <TextInput
            style={styles.input}
            placeholder="Nombre completo"
            placeholderTextColor={color.inkFaint}
            value={passengerName}
            onChangeText={setPassengerName}
          />
        </View>
        <View style={styles.inputWrap}>
          <Ionicons name="call-outline" size={18} color={color.inkFaint} />
          <TextInput
            style={styles.input}
            placeholder="Teléfono"
            placeholderTextColor={color.inkFaint}
            keyboardType="phone-pad"
            value={passengerPhone}
            onChangeText={setPassengerPhone}
          />
        </View>
      </Card>

      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={16} color={color.danger} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}

      <Button label="Confirmar reserva" onPress={confirm} loading={loading} style={styles.submit} />
      <Text style={styles.disclaimer}>El pago se coordina directamente con el operador. Próximamente pago en la app.</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  scroll: { padding: space.lg, gap: space.lg },
  divider: { height: 1, backgroundColor: color.border, marginVertical: space.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: space.md },
  rowLabel: { color: color.inkFaint, fontFamily: font.body, fontSize: 13 },
  rowValue: { color: color.ink, fontFamily: font.bodyMedium, fontSize: 13, flexShrink: 1, textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  totalLabel: { color: color.ink, fontFamily: font.bodySemi, fontSize: 14 },
  totalValue: { color: color.gold, fontFamily: font.displaySemi, fontSize: 22 },
  section: { gap: space.sm },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
  },
  input: { flex: 1, color: color.ink, fontFamily: font.body, fontSize: 15, paddingVertical: 4 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  error: { color: color.danger, fontFamily: font.bodyMedium, fontSize: 13, flexShrink: 1 },
  submit: { marginTop: space.sm },
  disclaimer: { color: color.inkFaint, fontFamily: font.body, fontSize: 11, textAlign: 'center' },
})
