// ── Paso 1: origen, destino, fecha/hora, pasajeros ─────────────────────────
// Sprint 2: autocomplete de direcciones con Google Places (vía proxy
// server-side, ver components/AddressAutocomplete.tsx) — si el usuario
// selecciona una sugerencia, se usan sus coordenadas exactas + código
// postal (mejora la resolución de zona de precio). Si escribe sin
// seleccionar nada, se mantiene el fallback del Sprint 1: geocodificación
// con el geocoder nativo del dispositivo (expo-location, gratis).
// Chips rápidos + selector de fecha/hora nativo (@react-native-community/
// datetimepicker) para paridad con el <input type="date"/"time"> de la
// web — antes solo existían los chips, sin forma de agendar un viaje en
// una fecha/hora arbitraria.

import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Modal } from 'react-native'
import * as Location from 'expo-location'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AddressAutocomplete } from '../components/AddressAutocomplete'
import { PressableScale } from '../components/PressableScale'
import { Button, Card, SectionLabel } from '../components/ui'
import { color, font, radius, space } from '../lib/theme'
import type { BookingStackParamList } from '../lib/types'

type Props = NativeStackScreenProps<BookingStackParamList, 'NewBooking'>

interface ResolvedPlace {
  lat: number
  lng: number
  placeId: string
  postalCode: string | null
}

const TIME_OPTIONS = [
  { label: 'En 30 min', minutesFromNow: 30 },
  { label: 'En 1 hora', minutesFromNow: 60 },
  { label: 'En 2 horas', minutesFromNow: 120 },
  { label: 'Mañana 9:00 AM', tomorrowAt9: true },
] as const

// -1 = el pasajero eligió una fecha/hora específica con el date picker nativo.
const CUSTOM_OPTION = -1

function resolveScheduledAt(optionIndex: number): Date {
  const opt = TIME_OPTIONS[optionIndex]
  const now = new Date()
  if ('tomorrowAt9' in opt) {
    const d = new Date(now)
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    return d
  }
  return new Date(now.getTime() + opt.minutesFromNow * 60_000)
}

function formatCustomDateTime(d: Date): string {
  const datePart = d.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })
  const timePart = d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })
  return `${datePart}, ${timePart}`
}

export function NewBookingScreen({ navigation }: Props) {
  const [pickupAddress, setPickupAddress] = useState('')
  const [pickupResolved, setPickupResolved] = useState<ResolvedPlace | null>(null)
  const [dropoffAddress, setDropoffAddress] = useState('')
  const [dropoffResolved, setDropoffResolved] = useState<ResolvedPlace | null>(null)
  const [timeOption, setTimeOption] = useState<number>(0)
  const [customDateTime, setCustomDateTime] = useState<Date | null>(null)
  const [pickerStep, setPickerStep] = useState<'date' | 'time' | null>(null)
  const [passengerCount, setPassengerCount] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function scheduledAtValue(): Date {
    if (timeOption === CUSTOM_OPTION && customDateTime) return customDateTime
    return resolveScheduledAt(timeOption)
  }

  function openCustomPicker() {
    setPickerStep('date')
  }

  function handleDateChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setPickerStep(null)
    if (event.type === 'dismissed' || !selected) return
    // Guarda solo la parte de fecha por ahora; la hora se combina en el paso siguiente.
    const base = customDateTime ?? new Date()
    const combined = new Date(selected)
    combined.setHours(base.getHours(), base.getMinutes(), 0, 0)
    setCustomDateTime(combined)
    setPickerStep('time')
  }

  function handleTimeChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setPickerStep(null)
    if (event.type === 'dismissed' || !selected) return
    setCustomDateTime((prev) => {
      const base = prev ?? new Date()
      const combined = new Date(base)
      combined.setHours(selected.getHours(), selected.getMinutes(), 0, 0)
      return combined
    })
    setTimeOption(CUSTOM_OPTION)
  }

  async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const results = await Location.geocodeAsync(address)
      const first = results[0]
      if (!first) return null
      return { lat: first.latitude, lng: first.longitude }
    } catch {
      return null
    }
  }

  async function resolveAddress(
    address: string,
    resolved: ResolvedPlace | null,
  ): Promise<{ lat: number; lng: number; placeId?: string; postalCode?: string | null } | null> {
    if (resolved) return resolved
    const geocoded = await geocode(address)
    return geocoded
  }

  async function handleContinue() {
    setError('')
    if (!pickupAddress.trim() || !dropoffAddress.trim()) {
      setError('Completa el origen y el destino')
      return
    }
    setLoading(true)
    const [pickup, dropoff] = await Promise.all([
      resolveAddress(pickupAddress, pickupResolved),
      resolveAddress(dropoffAddress, dropoffResolved),
    ])
    setLoading(false)

    if (!pickup) {
      setError('No pudimos ubicar la dirección de origen. Sé más específico (calle, ciudad).')
      return
    }
    if (!dropoff) {
      setError('No pudimos ubicar la dirección de destino. Sé más específico (calle, ciudad).')
      return
    }

    navigation.navigate('VehicleSelect', {
      draft: {
        pickupAddress: pickupAddress.trim(),
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        pickupPlaceId: pickup.placeId,
        pickupPostalCode: pickup.postalCode ?? undefined,
        dropoffAddress: dropoffAddress.trim(),
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        dropoffPlaceId: dropoff.placeId,
        dropoffPostalCode: dropoff.postalCode ?? undefined,
        scheduledAt: scheduledAtValue().toISOString(),
        passengerCount,
      },
    })
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Card style={styles.addressCard}>
          <SectionLabel>Origen</SectionLabel>
          <AddressAutocomplete
            icon="ellipse"
            iconColor={color.gold}
            placeholder="Dirección de recogida"
            value={pickupAddress}
            onChangeText={(text) => {
              setPickupAddress(text)
              setPickupResolved(null)
            }}
            onSelect={(details) =>
              setPickupResolved({ lat: details.lat, lng: details.lng, placeId: details.placeId, postalCode: details.postalCode })
            }
          />

          <View style={styles.divider} />

          <SectionLabel>Destino</SectionLabel>
          <AddressAutocomplete
            icon="location"
            iconColor={color.danger}
            placeholder="Dirección de destino"
            value={dropoffAddress}
            onChangeText={(text) => {
              setDropoffAddress(text)
              setDropoffResolved(null)
            }}
            onSelect={(details) =>
              setDropoffResolved({ lat: details.lat, lng: details.lng, placeId: details.placeId, postalCode: details.postalCode })
            }
          />
        </Card>

        <View style={styles.section}>
          <SectionLabel>¿Cuándo?</SectionLabel>
          <View style={styles.chipRow}>
            {TIME_OPTIONS.map((opt, i) => {
              const active = timeOption === i
              return (
                <PressableScale key={opt.label} onPress={() => setTimeOption(i)} haptic="light">
                  <View style={[styles.chip, active && styles.chipActive]}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                  </View>
                </PressableScale>
              )
            })}
            <PressableScale onPress={openCustomPicker} haptic="light">
              <View style={[styles.chip, styles.chipCustom, timeOption === CUSTOM_OPTION && styles.chipActive]}>
                <Ionicons name="calendar-outline" size={13} color={timeOption === CUSTOM_OPTION ? '#fff' : color.ink} />
                <Text style={[styles.chipText, timeOption === CUSTOM_OPTION && styles.chipTextActive]}>
                  {timeOption === CUSTOM_OPTION && customDateTime ? formatCustomDateTime(customDateTime) : 'Elegir fecha y hora'}
                </Text>
              </View>
            </PressableScale>
          </View>
        </View>

        {pickerStep === 'date' &&
          (Platform.OS === 'android' ? (
            <DateTimePicker
              value={customDateTime ?? new Date()}
              mode="date"
              display="default"
              minimumDate={new Date()}
              onChange={handleDateChange}
            />
          ) : (
            <Modal transparent animationType="fade">
              <View style={styles.pickerOverlay}>
                <View style={styles.pickerSheet}>
                  <DateTimePicker
                    value={customDateTime ?? new Date()}
                    mode="date"
                    display="spinner"
                    minimumDate={new Date()}
                    onChange={handleDateChange}
                  />
                  <Button label="Continuar" onPress={() => setPickerStep('time')} />
                </View>
              </View>
            </Modal>
          ))}

        {pickerStep === 'time' &&
          (Platform.OS === 'android' ? (
            <DateTimePicker
              value={customDateTime ?? new Date()}
              mode="time"
              display="default"
              onChange={handleTimeChange}
            />
          ) : (
            <Modal transparent animationType="fade">
              <View style={styles.pickerOverlay}>
                <View style={styles.pickerSheet}>
                  <DateTimePicker
                    value={customDateTime ?? new Date()}
                    mode="time"
                    display="spinner"
                    onChange={handleTimeChange}
                  />
                  <Button label="Listo" onPress={() => setPickerStep(null)} />
                </View>
              </View>
            </Modal>
          ))}

        <View style={styles.section}>
          <SectionLabel>Pasajeros</SectionLabel>
          <View style={styles.stepper}>
            <Text style={styles.stepperBtn} onPress={() => setPassengerCount((c) => Math.max(1, c - 1))}>
              −
            </Text>
            <Text style={styles.stepperValue}>{passengerCount}</Text>
            <Text style={styles.stepperBtn} onPress={() => setPassengerCount((c) => Math.min(10, c + 1))}>
              +
            </Text>
          </View>
        </View>

        {error ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={16} color={color.danger} />
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}

        <Button label="Ver vehículos disponibles" onPress={handleContinue} loading={loading} style={styles.submit} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  scroll: { padding: space.lg, gap: space.lg },
  addressCard: { zIndex: 10, overflow: 'visible' },
  divider: { height: 1, backgroundColor: color.border, marginVertical: space.sm },
  section: { gap: space.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  chipText: { fontFamily: font.bodyMedium, fontSize: 13, color: color.ink },
  chipActive: { backgroundColor: color.gold, borderColor: color.gold },
  chipTextActive: { color: '#fff' },
  chipCustom: { borderStyle: 'dashed' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: color.bgElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.xl },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.border,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontFamily: font.bodySemi,
    fontSize: 20,
    color: color.ink,
    overflow: 'hidden',
  },
  stepperValue: { fontFamily: font.displaySemi, fontSize: 20, color: color.ink, minWidth: 24, textAlign: 'center' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  error: { color: color.danger, fontFamily: font.bodyMedium, fontSize: 13, flexShrink: 1 },
  submit: { marginTop: space.md },
})
