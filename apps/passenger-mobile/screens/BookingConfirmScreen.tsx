// ── Paso 3: confirmar reserva ───────────────────────────────────────────────
// Método de pago declarado AL RESERVAR (no al terminar el viaje, como era
// antes) — mismo modelo que Uber: "Pagar ahora" (prioridad, cobra de una vez
// vía checkout de Whop) o "Tarjeta al finalizar"/"Efectivo" (se declara la
// intención, bookings.payment_method_intent, y el cobro de tarjeta ocurre
// solo al completar el viaje — ver autoChargeDeferredCardInBackground en
// apps/web/app/actions/payments.ts). "Tarjeta al finalizar" exige guardar
// una tarjeta (checkout de Whop en modo "setup", cobra $0) ANTES de poder
// confirmar si el pasajero no tiene ninguna en archivo todavía — sin esto no
// habría forma real de cobrar el viaje al terminar.

import { useEffect, useState } from 'react'
import { View, Text, TextInput, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { supabase } from '../lib/supabase'
import { callPassengerApi } from '../lib/api'
import { Button, Card, Field, SectionLabel } from '../components/ui'
import { PressableScale } from '../components/PressableScale'
import { color, font, radius, space } from '../lib/theme'
import type { BookingStackParamList, PaymentChoice } from '../lib/types'

type BookingFor = 'self' | 'other'

const SETUP_REDIRECT_URL = 'luxeride-passenger://payment-setup-complete'

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
  const companySlug = process.env.EXPO_PUBLIC_COMPANY_SLUG ?? ''
  const [bookingFor, setBookingFor] = useState<BookingFor>('self')
  const [myName, setMyName] = useState('')
  const [myPhone, setMyPhone] = useState('')
  const [passengerName, setPassengerName] = useState('')
  const [passengerPhone, setPassengerPhone] = useState('')
  const [specialInstructions, setSpecialInstructions] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>('pay_now')
  const [hasSavedCard, setHasSavedCard] = useState<boolean | null>(null)
  const [savedCard, setSavedCard] = useState<{ last4: string | null; brand: string | null } | null>(null)
  const [checkedPhone, setCheckedPhone] = useState<string | null>(null)
  const [checkingCard, setCheckingCard] = useState(false)
  const [settingUpCard, setSettingUpCard] = useState(false)
  const [cardSetupError, setCardSetupError] = useState('')

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
    // El teléfono cambió — la tarjeta guardada (si la había) era de OTRO
    // número, hay que volver a consultar.
    setHasSavedCard(null)
    setSavedCard(null)
    setCheckedPhone(null)
  }

  async function checkSavedCard(phone: string) {
    if (!phone.trim() || checkingCard) return
    setCheckingCard(true)
    const result = await callPassengerApi<{ found: boolean; card?: { last4: string | null; brand: string | null } }>(
      'saved-card-by-phone',
      { companySlug, phone: phone.trim() },
    )
    setCheckingCard(false)
    setCheckedPhone(phone.trim())
    setHasSavedCard(Boolean(result.found))
    setSavedCard(result.card ?? null)
  }

  function selectPaymentChoice(choice: PaymentChoice) {
    setPaymentChoice(choice)
    setCardSetupError('')
    if (choice === 'card_later' && passengerPhone.trim() && checkedPhone !== passengerPhone.trim()) {
      checkSavedCard(passengerPhone)
    }
  }

  async function setupCard() {
    setCardSetupError('')
    setSettingUpCard(true)
    const result = await callPassengerApi<{ data?: { url: string } }>('setup-card', {
      companySlug,
      phone: passengerPhone.trim(),
    })
    if (!result.success || !result.data?.url) {
      setSettingUpCard(false)
      setCardSetupError(result.error ?? 'No se pudo iniciar el guardado de la tarjeta')
      return
    }
    await WebBrowser.openAuthSessionAsync(result.data.url, SETUP_REDIRECT_URL)

    // El pasajero necesita saber POR QUÉ no quedó guardada — no solo que no
    // se encontró tarjeta. Consulta el estado real del intento en Whop
    // (rechazada, cancelada, el banco pidió un paso extra) en vez de dejarlo
    // en silencio con el mismo banner de "guarda tu tarjeta" de antes.
    const status = await callPassengerApi<{ status?: string; errorMessage?: string | null }>(
      'card-setup-status',
      { companySlug, phone: passengerPhone.trim() },
    )
    if (status.status === 'succeeded') {
      await checkSavedCard(passengerPhone)
    } else {
      const fallback =
        status.status === 'canceled'
          ? 'Cancelaste el guardado de la tarjeta. Intenta de nuevo.'
          : status.status === 'requires_action'
            ? 'Tu banco pidió un paso adicional que no se completó. Intenta de nuevo.'
            : status.status === 'processing'
              ? 'Estamos confirmando tu tarjeta. Espera unos segundos e intenta de nuevo.'
              : 'No se pudo confirmar el guardado de la tarjeta. Intenta de nuevo.'
      setCardSetupError(status.errorMessage || fallback)
    }
    setSettingUpCard(false)
  }

  const cardLaterBlocked = paymentChoice === 'card_later' && !hasSavedCard

  async function confirm() {
    setError('')
    if (!passengerName.trim() || !passengerPhone.trim()) {
      setError('Nombre y teléfono son requeridos')
      return
    }
    if (cardLaterBlocked) {
      setError('Guarda tu tarjeta para continuar, o elige otro método de pago')
      return
    }
    setLoading(true)
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
      paymentMethodIntent: paymentChoice === 'cash' ? 'cash' : 'card',
    })
    if (!result.success || !result.data) {
      setLoading(false)
      setError(result.error ?? 'No se pudo crear la reserva')
      return
    }

    if (paymentChoice === 'pay_now') {
      const checkout = await callPassengerApi<{ data?: { url: string } }>('checkout', {
        companySlug,
        bookingId: result.data.bookingId,
      })
      if (checkout.success && checkout.data?.url) {
        await WebBrowser.openAuthSessionAsync(checkout.data.url, SETUP_REDIRECT_URL)
      }
    }

    setLoading(false)
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
        <SectionLabel>Método de pago</SectionLabel>

        <PressableScale onPress={() => selectPaymentChoice('pay_now')} haptic="light">
          <View style={[styles.payNow, paymentChoice === 'pay_now' && styles.payNowActive]}>
            <View style={styles.payNowHeader}>
              <Ionicons name="flash" size={18} color={paymentChoice === 'pay_now' ? '#fff' : color.gold} />
              <Text style={[styles.payNowTitle, paymentChoice === 'pay_now' && styles.payNowTitleActive]}>
                Pagar ahora
              </Text>
              <View style={styles.recommendedPill}>
                <Text style={styles.recommendedPillText}>Recomendado</Text>
              </View>
            </View>
            <Text style={[styles.payNowSubtitle, paymentChoice === 'pay_now' && styles.payNowSubtitleActive]}>
              Cobra tu viaje ahora con tarjeta
            </Text>
          </View>
        </PressableScale>

        <View style={styles.altRow}>
          <PressableScale onPress={() => selectPaymentChoice('card_later')} style={styles.altItem} haptic="light">
            <View style={[styles.altChip, paymentChoice === 'card_later' && styles.altChipActive]}>
              <Ionicons name="card-outline" size={15} color={paymentChoice === 'card_later' ? color.gold : color.inkFaint} />
              <Text style={[styles.altChipText, paymentChoice === 'card_later' && styles.altChipTextActive]}>
                Tarjeta al finalizar
              </Text>
            </View>
          </PressableScale>
          <PressableScale onPress={() => selectPaymentChoice('cash')} style={styles.altItem} haptic="light">
            <View style={[styles.altChip, paymentChoice === 'cash' && styles.altChipActive]}>
              <Ionicons name="cash-outline" size={15} color={paymentChoice === 'cash' ? color.gold : color.inkFaint} />
              <Text style={[styles.altChipText, paymentChoice === 'cash' && styles.altChipTextActive]}>
                Efectivo
              </Text>
            </View>
          </PressableScale>
        </View>

        {paymentChoice === 'card_later' && (
          <View style={styles.cardStatusBox}>
            {checkingCard ? (
              <View style={styles.cardStatusRow}>
                <ActivityIndicator color={color.gold} size="small" />
                <Text style={styles.cardStatusText}>Buscando tarjeta guardada…</Text>
              </View>
            ) : hasSavedCard ? (
              <View style={styles.cardStatusRow}>
                <Ionicons name="checkmark-circle" size={16} color={color.success} />
                <Text style={styles.cardStatusText}>
                  {savedCard ? `Tarjeta ${savedCard.brand ?? ''} •••• ${savedCard.last4 ?? '····'} lista` : 'Tarjeta guardada lista'}
                </Text>
              </View>
            ) : (
              <View style={styles.cardSetupBanner}>
                <Text style={styles.cardSetupText}>Guarda tu tarjeta para poder cobrar al finalizar el viaje.</Text>
                <Button
                  label="Guardar tarjeta"
                  onPress={setupCard}
                  loading={settingUpCard}
                  variant="secondary"
                  style={styles.cardSetupButton}
                />
                {cardSetupError ? <Text style={styles.cardStatusError}>{cardSetupError}</Text> : null}
              </View>
            )}
          </View>
        )}

        {paymentChoice === 'cash' && (
          <Text style={styles.cashNote}>Le pagas directo al conductor cuando termine el viaje.</Text>
        )}
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
          onChangeText={(v) => {
            setPassengerPhone(v)
            setHasSavedCard(null)
            setSavedCard(null)
            setCheckedPhone(null)
          }}
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

      <Button
        label="Confirmar reserva"
        onPress={confirm}
        loading={loading}
        disabled={cardLaterBlocked}
        style={styles.submit}
      />
      <Text style={styles.disclaimer}>
        {paymentChoice === 'pay_now'
          ? 'Se abrirá el pago seguro de Whop para completar tu cobro.'
          : paymentChoice === 'card_later'
            ? 'Se cobra automático a tu tarjeta cuando el viaje termine.'
            : 'El pago se coordina directamente con el conductor.'}
      </Text>
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
  // "Pagar ahora" — el método principal, visualmente por encima de los otros
  // dos (más grande, fondo dorado cuando seleccionado, pill "Recomendado").
  payNow: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: color.gold,
    padding: space.lg,
    gap: 4,
    backgroundColor: `${color.gold}14`,
  },
  payNowActive: { backgroundColor: color.gold },
  payNowHeader: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  payNowTitle: { color: color.ink, fontFamily: font.bodyBold, fontSize: 16 },
  payNowTitleActive: { color: '#fff' },
  recommendedPill: {
    marginLeft: 'auto',
    backgroundColor: color.ink,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  recommendedPillText: { color: '#fff', fontFamily: font.bodySemi, fontSize: 10, letterSpacing: 0.3 },
  payNowSubtitle: { color: color.inkFaint, fontFamily: font.body, fontSize: 12 },
  payNowSubtitleActive: { color: '#fffc' },
  altRow: { flexDirection: 'row', gap: space.sm },
  altItem: { flex: 1 },
  altChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceRaised,
  },
  altChipActive: { borderColor: color.gold, backgroundColor: `${color.gold}14` },
  altChipText: { color: color.inkFaint, fontFamily: font.bodyMedium, fontSize: 12.5 },
  altChipTextActive: { color: color.ink },
  cardStatusBox: { marginTop: 2 },
  cardStatusRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  cardStatusText: { color: color.inkFaint, fontFamily: font.body, fontSize: 12.5, flexShrink: 1 },
  cardSetupBanner: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.border,
  },
  cardSetupText: { color: color.ink, fontFamily: font.body, fontSize: 12.5 },
  cardSetupButton: { alignSelf: 'flex-start', paddingHorizontal: space.lg },
  cardStatusError: { color: color.danger, fontFamily: font.bodyMedium, fontSize: 12 },
  cashNote: { color: color.inkFaint, fontFamily: font.body, fontSize: 12.5 },
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
