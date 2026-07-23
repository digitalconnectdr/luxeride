// ── Login + registro del pasajero ──────────────────────────────────────────
// Login: supabase.auth.signInWithPassword directo (igual que driver-mobile
// — no necesita pasar por el servidor). Registro: SÍ necesita el servidor
// (crear auth.users + user_profiles con service-role, ver
// app/actions/passenger-auth.ts) — la respuesta trae la sesión ya lista, que
// se guarda en este cliente con supabase.auth.setSession(). Marca (logo/
// nombre/color) dinámica vía BrandingProvider — white-label real, no texto
// fijo de "LuxeRide".

import { useRef, useState } from 'react'
import { View, Text, TextInput, StyleSheet, Animated, KeyboardAvoidingView, Platform, Keyboard, ScrollView, Modal } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { supabase } from '../lib/supabase'
import { callPassengerApi } from '../lib/api'
import { useBranding } from '../lib/branding'
import { BrandMark } from '../components/BrandMark'
import { PressableScale } from '../components/PressableScale'
import { Button } from '../components/ui'
import { color, font, radius, space } from '../lib/theme'

function formatDob(d: Date): string {
  return d.toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' })
}

type Mode = 'login' | 'signup'

export function AuthScreen({ roleError }: { roleError?: string }) {
  const { branding } = useBranding()
  const [mode, setMode] = useState<Mode>('login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null)
  const [showDobPicker, setShowDobPicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focusedField, setFocusedField] = useState<string | null>(null)

  function handleDobChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowDobPicker(false)
    if (event.type === 'dismissed' || !selected) return
    setDateOfBirth(selected)
  }

  const shake = useRef(new Animated.Value(0)).current

  function playShake() {
    shake.setValue(0)
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start()
  }

  async function signIn() {
    Keyboard.dismiss()
    setError('')
    setLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (signInError) {
      setError(signInError.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : signInError.message)
      playShake()
    }
  }

  async function signUp() {
    Keyboard.dismiss()
    setError('')
    setLoading(true)
    const companySlug = process.env.EXPO_PUBLIC_COMPANY_SLUG ?? ''
    const result = await callPassengerApi<{ session?: { access_token: string; refresh_token: string } }>('signup', {
      companySlug,
      email: email.trim(),
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim() || undefined,
      dateOfBirth: dateOfBirth!.toISOString().slice(0, 10),
    })
    if (!result.success || !result.session) {
      setLoading(false)
      setError(result.error ?? 'No se pudo crear la cuenta')
      playShake()
      return
    }
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: result.session.access_token,
      refresh_token: result.session.refresh_token,
    })
    setLoading(false)
    if (sessionError) {
      setError('Cuenta creada. Inicia sesión.')
      setMode('login')
    }
  }

  const displayError = error || roleError
  const isSignup = mode === 'signup'
  const canSubmit = isSignup
    ? !!(email && password && firstName && lastName && dateOfBirth)
    : !!(email && password)

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brandBlock}>
          <BrandMark size={56} />
          <Text style={styles.title}>{branding.name}</Text>
          <Text style={styles.subtitle}>{isSignup ? 'CREA TU CUENTA' : 'BIENVENIDO DE VUELTA'}</Text>
        </View>

        <Animated.View
          style={[
            styles.form,
            { transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) }] },
          ]}
        >
          {isSignup && (
            <View style={styles.row}>
              <Field
                icon="person-outline"
                placeholder="Nombre"
                value={firstName}
                onChangeText={setFirstName}
                focused={focusedField === 'firstName'}
                onFocus={() => setFocusedField('firstName')}
                onBlur={() => setFocusedField(null)}
                style={styles.rowItem}
              />
              <Field
                icon="person-outline"
                placeholder="Apellido"
                value={lastName}
                onChangeText={setLastName}
                focused={focusedField === 'lastName'}
                onFocus={() => setFocusedField('lastName')}
                onBlur={() => setFocusedField(null)}
                style={styles.rowItem}
              />
            </View>
          )}

          <Field
            icon="mail-outline"
            placeholder="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            focused={focusedField === 'email'}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
          />

          {isSignup && (
            <Field
              icon="call-outline"
              placeholder="Teléfono (opcional)"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              focused={focusedField === 'phone'}
              onFocus={() => setFocusedField('phone')}
              onBlur={() => setFocusedField(null)}
            />
          )}

          {isSignup && (
            <PressableScale onPress={() => setShowDobPicker(true)}>
              <View style={[styles.inputWrap, showDobPicker && styles.inputWrapFocused]}>
                <Ionicons name="gift-outline" size={18} color={dateOfBirth ? color.gold : color.inkFaint} />
                <Text style={[styles.input, !dateOfBirth && styles.inputPlaceholder]}>
                  {dateOfBirth ? formatDob(dateOfBirth) : 'Fecha de nacimiento'}
                </Text>
              </View>
            </PressableScale>
          )}

          <Field
            icon="lock-closed-outline"
            placeholder="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            focused={focusedField === 'password'}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField(null)}
            onSubmitEditing={isSignup ? signUp : signIn}
          />

          {displayError ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={16} color={color.danger} />
              <Text style={styles.error}>{displayError}</Text>
            </View>
          ) : null}

          <Button
            label={isSignup ? 'Crear cuenta' : 'Iniciar sesión'}
            onPress={isSignup ? signUp : signIn}
            loading={loading}
            disabled={!canSubmit}
            style={styles.submit}
          />
        </Animated.View>

        <Text style={styles.toggle} onPress={() => { setError(''); setMode(isSignup ? 'login' : 'signup') }}>
          {isSignup ? '¿Ya tienes cuenta? Inicia sesión' : '¿Primera vez? Crea tu cuenta'}
        </Text>
      </ScrollView>

      {showDobPicker &&
        (Platform.OS === 'android' ? (
          <DateTimePicker
            value={dateOfBirth ?? DEFAULT_DOB}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={handleDobChange}
          />
        ) : (
          <Modal transparent animationType="fade">
            <View style={styles.pickerOverlay}>
              <View style={styles.pickerSheet}>
                <DateTimePicker
                  value={dateOfBirth ?? DEFAULT_DOB}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={handleDobChange}
                />
                <Button label="Listo" onPress={() => setShowDobPicker(false)} />
              </View>
            </View>
          </Modal>
        ))}
    </KeyboardAvoidingView>
  )
}

// Punto de partida razonable para el spinner (25 años atrás) — el usuario
// lo cambia libremente, esto solo evita arrancar en "hoy".
const DEFAULT_DOB = new Date(new Date().getFullYear() - 25, 0, 1)

interface FieldProps {
  icon: keyof typeof Ionicons.glyphMap
  placeholder: string
  value: string
  onChangeText: (v: string) => void
  focused: boolean
  onFocus: () => void
  onBlur: () => void
  secureTextEntry?: boolean
  keyboardType?: 'default' | 'email-address' | 'phone-pad'
  autoCapitalize?: 'none' | 'words'
  onSubmitEditing?: () => void
  style?: object
}

function Field({ icon, focused, style, ...inputProps }: FieldProps) {
  return (
    <View style={[styles.inputWrap, focused && styles.inputWrapFocused, style]}>
      <Ionicons name={icon} size={18} color={focused ? color.gold : color.inkFaint} />
      <TextInput style={styles.input} placeholderTextColor={color.inkFaint} autoCorrect={false} {...inputProps} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: space.xl },
  brandBlock: { alignItems: 'center', marginBottom: space.xxxl, gap: space.md },
  title: { color: color.ink, fontFamily: font.display, fontSize: 32, letterSpacing: 0.3 },
  subtitle: { color: color.inkFaint, fontFamily: font.bodySemi, fontSize: 11, letterSpacing: 2.5 },
  form: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  rowItem: { flex: 1 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: color.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  },
  inputWrapFocused: { borderColor: color.gold },
  input: { flex: 1, color: color.ink, fontFamily: font.body, fontSize: 15, paddingVertical: 0 },
  inputPlaceholder: { color: color.inkFaint },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: color.bgElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs },
  error: { color: color.danger, fontFamily: font.bodyMedium, fontSize: 13, flexShrink: 1 },
  submit: { marginTop: space.sm },
  toggle: {
    color: color.gold,
    fontFamily: font.bodySemi,
    fontSize: 13,
    textAlign: 'center',
    marginTop: space.xxl,
  },
})
