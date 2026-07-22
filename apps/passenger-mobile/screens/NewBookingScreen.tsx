// ── Paso 1: origen, destino, fecha/hora, pasajeros ─────────────────────────
// Sprint 1: direcciones en texto libre + geocodificación con el geocoder
// nativo del dispositivo (expo-location, gratis, sin API key propia) — el
// autocomplete real con Google Places llega en el Sprint 2 junto con el
// mapa interactivo (ver plan). Selector de fecha/hora por chips rápidos en
// vez de un date picker nativo, para no arrastrar una dependencia nueva
// solo para esto.

import { useState } from 'react'
import { View, Text, TextInput, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import * as Location from 'expo-location'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Button, Card, SectionLabel } from '../components/ui'
import { color, font, radius, space } from '../lib/theme'
import type { BookingStackParamList } from '../lib/types'

type Props = NativeStackScreenProps<BookingStackParamList, 'NewBooking'>

const TIME_OPTIONS = [
  { label: 'En 30 min', minutesFromNow: 30 },
  { label: 'En 1 hora', minutesFromNow: 60 },
  { label: 'En 2 horas', minutesFromNow: 120 },
  { label: 'Mañana 9:00 AM', tomorrowAt9: true },
] as const

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

export function NewBookingScreen({ navigation }: Props) {
  const [pickupAddress, setPickupAddress] = useState('')
  const [dropoffAddress, setDropoffAddress] = useState('')
  const [timeOption, setTimeOption] = useState(0)
  const [passengerCount, setPassengerCount] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  async function handleContinue() {
    setError('')
    if (!pickupAddress.trim() || !dropoffAddress.trim()) {
      setError('Completa el origen y el destino')
      return
    }
    setLoading(true)
    const [pickup, dropoff] = await Promise.all([geocode(pickupAddress), geocode(dropoffAddress)])
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
        dropoffAddress: dropoffAddress.trim(),
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        scheduledAt: resolveScheduledAt(timeOption).toISOString(),
        passengerCount,
      },
    })
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Card>
          <SectionLabel>Origen</SectionLabel>
          <View style={styles.inputWrap}>
            <Ionicons name="ellipse" size={10} color={color.gold} />
            <TextInput
              style={styles.input}
              placeholder="Dirección de recogida"
              placeholderTextColor={color.inkFaint}
              value={pickupAddress}
              onChangeText={setPickupAddress}
            />
          </View>

          <View style={styles.divider} />

          <SectionLabel>Destino</SectionLabel>
          <View style={styles.inputWrap}>
            <Ionicons name="location" size={14} color={color.danger} />
            <TextInput
              style={styles.input}
              placeholder="Dirección de destino"
              placeholderTextColor={color.inkFaint}
              value={dropoffAddress}
              onChangeText={setDropoffAddress}
            />
          </View>
        </Card>

        <View style={styles.section}>
          <SectionLabel>¿Cuándo?</SectionLabel>
          <View style={styles.chipRow}>
            {TIME_OPTIONS.map((opt, i) => (
              <Text
                key={opt.label}
                style={[styles.chip, timeOption === i && styles.chipActive]}
                onPress={() => setTimeOption(i)}
              >
                {opt.label}
              </Text>
            ))}
          </View>
        </View>

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
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
  },
  divider: { height: 1, backgroundColor: color.border, marginVertical: space.sm },
  input: { flex: 1, color: color.ink, fontFamily: font.body, fontSize: 15, paddingVertical: 4 },
  section: { gap: space.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    fontFamily: font.bodyMedium,
    fontSize: 13,
    color: color.ink,
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    overflow: 'hidden',
  },
  chipActive: { backgroundColor: color.gold, borderColor: color.gold, color: '#fff' },
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
