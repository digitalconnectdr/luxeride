// ── Input de dirección con autocomplete de Google Places ──────────────────
// Semi-controlado: el texto vive en el padre (onChangeText en cada tecla,
// para que el padre siempre tenga un valor de respaldo aunque el usuario
// nunca toque una sugerencia — NewBookingScreen sigue geocodificando ese
// texto con expo-location como red de seguridad, igual que en el Sprint 1).
// Al tocar una sugerencia, resuelve lat/lng/postalCode y llama onSelect.

import { useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { searchAddress, resolvePlace, newPlacesSessionToken, type PlacePrediction, type PlaceDetails } from '../lib/places'
import { color, font, radius, space, shadow } from '../lib/theme'

interface Props {
  icon: keyof typeof Ionicons.glyphMap
  iconColor?: string
  placeholder: string
  value: string
  onChangeText: (text: string) => void
  onSelect: (details: PlaceDetails & { placeId: string }) => void
}

const DEBOUNCE_MS = 300

export function AddressAutocomplete({ icon, iconColor, placeholder, value, onChangeText, onSelect }: Props) {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([])
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const sessionToken = useRef(newPlacesSessionToken())
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  function handleChangeText(text: string) {
    onChangeText(text)
    setPredictions([])

    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    if (text.trim().length < 3) {
      setLoading(false)
      return
    }

    setLoading(true)
    const thisRequest = ++requestId.current
    debounceTimer.current = setTimeout(async () => {
      const results = await searchAddress(text, sessionToken.current)
      if (requestId.current === thisRequest) {
        setPredictions(results)
        setLoading(false)
      }
    }, DEBOUNCE_MS)
  }

  async function handleSelect(prediction: PlacePrediction) {
    setPredictions([])
    setLoading(true)
    const details = await resolvePlace(prediction.placeId, sessionToken.current)
    setLoading(false)
    if (!details) return
    onChangeText(details.address)
    onSelect({ ...details, placeId: prediction.placeId })
    sessionToken.current = newPlacesSessionToken()
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.inputRow}>
        <Ionicons name={icon} size={14} color={iconColor ?? color.inkFaint} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={color.inkFaint}
          value={value}
          onChangeText={handleChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
        />
        {loading && <ActivityIndicator size="small" color={color.gold} />}
      </View>

      {focused && predictions.length > 0 && (
        <View style={styles.dropdown}>
          {predictions.map((p) => (
            <Pressable key={p.placeId} style={styles.suggestion} onPress={() => handleSelect(p)}>
              <Ionicons name="location-outline" size={16} color={color.inkFaint} />
              <Text style={styles.suggestionText} numberOfLines={2}>{p.description}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', zIndex: 10 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
  },
  input: { flex: 1, color: color.ink, fontFamily: font.body, fontSize: 15, paddingVertical: 4 },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: color.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    marginTop: 4,
    zIndex: 20,
    ...shadow.floating,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  suggestionText: { flex: 1, color: color.ink, fontFamily: font.body, fontSize: 13 },
})
