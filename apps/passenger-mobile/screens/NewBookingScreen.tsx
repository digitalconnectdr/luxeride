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

import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Modal } from 'react-native'
import * as Location from 'expo-location'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { supabase } from '../lib/supabase'
import { AddressAutocomplete } from '../components/AddressAutocomplete'
import { PressableScale } from '../components/PressableScale'
import { Button, Card, SectionLabel } from '../components/ui'
import { font, radius, space, useThemedStyles, usePalette, type Palette } from '../lib/theme'
import type { BookingStackParamList } from '../lib/types'

interface SavedAddress { id: string; label: string; address: string; lat: number; lng: number }

const SAVED_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  Casa: 'home-outline',
  Trabajo: 'briefcase-outline',
}

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

export function NewBookingScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(makeStyles)
  const c = usePalette()
  // "Reservar de nuevo" desde Mis viajes llega con prefill — no hay
  // placeId/código postal guardados en bookings, así que se marca como "no
  // resuelto por autocomplete" (placeId vacío) pero sí trae lat/lng reales,
  // suficiente para cotizar sin tener que re-geocodificar el texto.
  const prefill = route.params?.prefill
  const [pickupAddress, setPickupAddress] = useState(prefill?.pickupAddress ?? '')
  const [pickupResolved, setPickupResolved] = useState<ResolvedPlace | null>(
    prefill ? { lat: prefill.pickupLat, lng: prefill.pickupLng, placeId: '', postalCode: null } : null,
  )
  const [dropoffAddress, setDropoffAddress] = useState(prefill?.dropoffAddress ?? '')
  const [dropoffResolved, setDropoffResolved] = useState<ResolvedPlace | null>(
    prefill ? { lat: prefill.dropoffLat, lng: prefill.dropoffLng, placeId: '', postalCode: null } : null,
  )
  const [timeOption, setTimeOption] = useState<number>(0)
  const [customDateTime, setCustomDateTime] = useState<Date | null>(null)
  const [pickerStep, setPickerStep] = useState<'date' | 'time' | null>(null)
  const [passengerCount, setPassengerCount] = useState(prefill?.passengerCount ?? 1)

  // Si la pantalla ya estaba montada (el pasajero ya había visitado esta
  // pestaña antes), el useState de arriba no vuelve a leer el prefill al
  // navegar de nuevo con nuevos params — cada "Reservar de nuevo" arma un
  // objeto nuevo, así que la referencia cambia y este efecto sí reacciona.
  useEffect(() => {
    if (!prefill) return
    setPickupAddress(prefill.pickupAddress)
    setPickupResolved({ lat: prefill.pickupLat, lng: prefill.pickupLng, placeId: '', postalCode: null })
    setDropoffAddress(prefill.dropoffAddress)
    setDropoffResolved({ lat: prefill.dropoffLat, lng: prefill.dropoffLng, placeId: '', postalCode: null })
    if (prefill.passengerCount) setPassengerCount(prefill.passengerCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])

  useEffect(() => {
    async function loadSaved() {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return
      const { data } = await supabase
        .from('passenger_saved_addresses')
        .select('id, label, address, lat, lng')
        .eq('customer_id', auth.user.id)
        .order('created_at', { ascending: true })
      setSavedAddresses((data ?? []) as SavedAddress[])
    }
    loadSaved()
  }, [])

  function pickSaved(item: SavedAddress, target: 'pickup' | 'dropoff') {
    if (target === 'pickup') {
      setPickupAddress(item.address)
      setPickupResolved({ lat: item.lat, lng: item.lng, placeId: '', postalCode: null })
    } else {
      setDropoffAddress(item.address)
      setDropoffResolved({ lat: item.lat, lng: item.lng, placeId: '', postalCode: null })
    }
  }

  // Intercambiar origen y destino — el viaje de vuelta es el caso más común
  // después de reservar la ida, y sin esto había que reescribir las dos
  // direcciones a mano.
  function swapAddresses() {
    setPickupAddress(dropoffAddress)
    setPickupResolved(dropoffResolved)
    setDropoffAddress(pickupAddress)
    setDropoffResolved(pickupResolved)
  }

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
          <View style={styles.routeHeader}>
            <SectionLabel>Ruta del viaje</SectionLabel>
            <PressableScale onPress={swapAddresses} hitSlop={8} haptic="light">
              <View style={styles.swapButton}>
                <Ionicons name="swap-vertical" size={16} color={c.gold} />
              </View>
            </PressableScale>
          </View>

          <View style={styles.routeField}>
            <AddressAutocomplete
              icon="ellipse"
              iconColor={c.gold}
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
            <Text style={styles.routeCaption}>Dirección de recogida</Text>
          </View>
          {savedAddresses.length > 0 && (
            <View style={styles.savedRow}>
              {savedAddresses.map((item) => (
                <PressableScale key={item.id} onPress={() => pickSaved(item, 'pickup')} haptic="light">
                  <View style={styles.savedChip}>
                    <Ionicons name={SAVED_ICON[item.label] ?? 'location-outline'} size={11} color={c.gold} />
                    <Text style={styles.savedChipText}>{item.label}</Text>
                  </View>
                </PressableScale>
              ))}
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.routeField}>
            <AddressAutocomplete
              icon="location"
              iconColor={c.danger}
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
            <Text style={styles.routeCaption}>Dirección de destino</Text>
          </View>
          {savedAddresses.length > 0 && (
            <View style={styles.savedRow}>
              {savedAddresses.map((item) => (
                <PressableScale key={item.id} onPress={() => pickSaved(item, 'dropoff')} haptic="light">
                  <View style={styles.savedChip}>
                    <Ionicons name={SAVED_ICON[item.label] ?? 'location-outline'} size={11} color={c.gold} />
                    <Text style={styles.savedChipText}>{item.label}</Text>
                  </View>
                </PressableScale>
              ))}
            </View>
          )}
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
                <Ionicons name="calendar-outline" size={13} color={timeOption === CUSTOM_OPTION ? c.onGold : c.ink} />
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

        {/* Etiqueta y control en la MISMA fila (como el mockup) — apilados
        ocupaban el doble de alto para un solo número. */}
        <View style={styles.section}>
          <SectionLabel>Pasajeros</SectionLabel>
          <View style={styles.stepperRow}>
            <Text style={styles.stepperLabel}>Pasajeros</Text>
            <View style={styles.stepper}>
              <Text style={styles.stepperBtn} onPress={() => setPassengerCount((n) => Math.max(1, n - 1))}>
                −
              </Text>
              <Text style={styles.stepperValue}>{passengerCount}</Text>
              <Text style={styles.stepperBtn} onPress={() => setPassengerCount((n) => Math.min(10, n + 1))}>
                +
              </Text>
            </View>
          </View>
        </View>

        {error ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={16} color={c.danger} />
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}

        <Button label="Ver vehículos disponibles" onPress={handleContinue} loading={loading} style={styles.submit} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scroll: { padding: space.lg, gap: space.lg },
    addressCard: { zIndex: 10, overflow: 'visible' },
    routeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: space.xs,
    },
    swapButton: {
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      backgroundColor: c.goldWash,
      borderWidth: 1,
      borderColor: c.borderGold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    routeField: { gap: 0 },
    // Etiqueta bajo la dirección — el input ya usa el texto como valor, así
    // que la etiqueta no puede vivir en el placeholder: desaparecería en
    // cuanto el pasajero escriba algo.
    routeCaption: { color: c.inkFaint, fontFamily: font.body, fontSize: 11, marginLeft: 22, marginTop: -2 },
    divider: { height: 1, backgroundColor: c.border, marginVertical: space.sm },
    savedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs, marginBottom: space.xs },
    savedChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: space.sm,
      paddingVertical: 5,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceRaised,
    },
    savedChipText: { color: c.ink, fontFamily: font.bodyMedium, fontSize: 11 },
    section: { gap: space.sm },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.surfaceRaised,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.pill,
      paddingHorizontal: space.lg,
      paddingVertical: space.sm,
    },
    chipText: { fontFamily: font.bodyMedium, fontSize: 13, color: c.ink },
    chipActive: { backgroundColor: c.gold, borderColor: c.gold },
    chipTextActive: { color: c.onGold },
    chipCustom: { borderStyle: 'dashed' },
    pickerOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
    pickerSheet: {
      backgroundColor: c.bgElevated,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: space.lg,
      gap: space.md,
    },
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
    },
    stepperLabel: { color: c.ink, fontFamily: font.bodyMedium, fontSize: 14 },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
    stepperBtn: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      backgroundColor: c.surfaceRaised,
      borderWidth: 1,
      borderColor: c.border,
      textAlign: 'center',
      textAlignVertical: 'center',
      fontFamily: font.bodySemi,
      fontSize: 20,
      color: c.ink,
      overflow: 'hidden',
    },
    stepperValue: { fontFamily: font.bodyBold, fontSize: 20, color: c.ink, minWidth: 24, textAlign: 'center' },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    error: { color: c.danger, fontFamily: font.bodyMedium, fontSize: 13, flexShrink: 1 },
    submit: { marginTop: space.md },
  })
