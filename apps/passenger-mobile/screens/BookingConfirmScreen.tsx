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
import { Button, Card, Field, SectionLabel } from '../components/ui'
import { PressableScale } from '../components/PressableScale'
import { color, font, radius, space } from '../lib/theme'
import type { BookingStackParamList } from '../lib/types'

type BookingFor = 'self' | 'other'

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
  const [bookingFor, setBookingFor] = useState<BookingFor>('self')
  const [myName, setMyName] = useState('')
  const [myPhone, setMyPhone] = useState('')
  const [passengerName, setPassengerName] = useState('')
  const [passengerPhone, setPassengerPhone] = useState('')
  const [specialInstructions, setSpecialInstructions] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focusedField, setFocusedField] = useState<string | null>(null)

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
        const name = `${profile.first_name} ${profile.last_name}`.trim()
        setMyName(name)
        setMyPhone(profile.phone ?? '')
        setPassengerName(name)
        setPassengerPhone(profile.phone ?? '')
      }
    }
    prefill()
  }, [])

  // "Reservar para otra persona" no necesita nada nuevo en el backend:
  // bookings.passenger_name/passenger_phone YA son columnas separadas de
  // customer_id (el dueño de la cuenta que paga/reserva), pensadas
  // originalmente para el guest checkout de la web — aquí solo se expone
  // la opción de llenarlas con otros datos en vez de auto-rellenar los
  // propios. La reserva sigue apareciendo en "Mis viajes" de quien reserva.
  function selectBookingFor(next: BookingFor) {
    setBookingFor(next)
    if (next === 'self') {
      setPassengerName(myName)
      setPassengerPhone(myPhone)
    } else {
      setPassengerName('')
      setPassengerPhone('')
    }
  }

  async function confirm() {
    setError('')
    if (!passengerName.trim() || !passengerPhone.trim()) {
      setError('Nombre y teléfono son requeridos')
      return
    }
    setLoading(true)
    const companySlug = process.env.EXPO_PUBLIC_COMPANY_SLUG ?? ''
    const result = await callPassengerApi<{ data?: { bookingId: string; bookingNumber: string } }>('book', {
      quoteId: quote.quoteId,
      companySlug,
      passengerName: passengerName.trim(),
      passengerPhone: passengerPhone.trim(),
      passengerCount: draft.passengerCount,
      specialInstructions: specialInstructions.trim() || undefined,
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
    navigation.replace('BookingSuccess', { bookingId: result.data.bookingId, bookingNumber: result.data.bookingNumber })
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
        <View style={styles.forWhomRow}>
          <PressableScale onPress={() => selectBookingFor('self')} haptic="light">
            <View style={[styles.forWhomChip, bookingFor === 'self' && styles.forWhomChipActive]}>
              <Text style={[styles.forWhomChipText, bookingFor === 'self' && styles.forWhomChipTextActive]}>
                Para mí
              </Text>
            </View>
          </PressableScale>
          <PressableScale onPress={() => selectBookingFor('other')} haptic="light">
            <View style={[styles.forWhomChip, bookingFor === 'other' && styles.forWhomChipActive]}>
              <Text style={[styles.forWhomChipText, bookingFor === 'other' && styles.forWhomChipTextActive]}>
                Para otra persona
              </Text>
            </View>
          </PressableScale>
        </View>
        <Field
          icon="person-outline"
          placeholder={bookingFor === 'other' ? 'Nombre de la persona' : 'Nombre completo'}
          value={passengerName}
          onChangeText={setPassengerName}
          focused={focusedField === 'name'}
          onFocus={() => setFocusedField('name')}
          onBlur={() => setFocusedField(null)}
        />
        <Field
          icon="call-outline"
          placeholder={bookingFor === 'other' ? 'Teléfono de la persona' : 'Teléfono'}
          value={passengerPhone}
          onChangeText={setPassengerPhone}
          keyboardType="phone-pad"
          focused={focusedField === 'phone'}
          onFocus={() => setFocusedField('phone')}
          onBlur={() => setFocusedField(null)}
        />
        <View style={styles.divider} />
        <SectionLabel>Instrucciones especiales (opcional)</SectionLabel>
        <TextInput
          style={styles.textarea}
          placeholder="Ej. número de vuelo, puerta del edificio, señas particulares…"
          placeholderTextColor={color.inkFaint}
          value={specialInstructions}
          onChangeText={setSpecialInstructions}
          multiline
          numberOfLines={3}
        />
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
  forWhomRow: { flexDirection: 'row', gap: space.sm },
  forWhomChip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceRaised,
  },
  forWhomChipActive: { backgroundColor: color.gold, borderColor: color.gold },
  forWhomChipText: { color: color.ink, fontFamily: font.bodyMedium, fontSize: 13 },
  forWhomChipTextActive: { color: '#fff' },
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
  totalValue: { color: color.gold, fontFamily: font.bodyBold, fontSize: 22 },
  section: { gap: space.md },
  textarea: {
    color: color.ink,
    fontFamily: font.body,
    fontSize: 14,
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: space.md,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  error: { color: color.danger, fontFamily: font.bodyMedium, fontSize: 13, flexShrink: 1 },
  submit: { marginTop: space.sm },
  disclaimer: { color: color.inkFaint, fontFamily: font.body, fontSize: 11, textAlign: 'center' },
})
