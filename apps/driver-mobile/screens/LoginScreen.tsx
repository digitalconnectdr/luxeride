import { useRef, useState } from 'react'
import { View, Text, TextInput, StyleSheet, Animated, KeyboardAvoidingView, Platform, Keyboard } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui'
import { color, font, radius, space } from '../lib/theme'

export function LoginScreen({ roleError }: { roleError?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null)

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

  const displayError = error || roleError

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.brandBlock}>
        <View style={styles.mark}>
          <Text style={styles.markLetter}>L</Text>
        </View>
        <Text style={styles.title}>LuxeRide</Text>
        <Text style={styles.subtitle}>PORTAL DEL CONDUCTOR</Text>
      </View>

      <Animated.View
        style={[
          styles.form,
          { transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) }] },
        ]}
      >
        <View style={[styles.inputWrap, focusedField === 'email' && styles.inputWrapFocused]}>
          <Ionicons name="mail-outline" size={18} color={focusedField === 'email' ? color.gold : color.inkFaint} />
          <TextInput
            style={styles.input}
            placeholder="Correo electrónico"
            placeholderTextColor={color.inkFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
          />
        </View>

        <View style={[styles.inputWrap, focusedField === 'password' && styles.inputWrapFocused]}>
          <Ionicons name="lock-closed-outline" size={18} color={focusedField === 'password' ? color.gold : color.inkFaint} />
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor={color.inkFaint}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField(null)}
            onSubmitEditing={signIn}
          />
        </View>

        {displayError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={16} color={color.danger} />
            <Text style={styles.error}>{displayError}</Text>
          </View>
        ) : null}

        <Button label="Iniciar sesión" onPress={signIn} loading={loading} disabled={!email || !password} style={styles.submit} />
      </Animated.View>

      <Text style={styles.footer}>Acceso exclusivo para conductores de la flota</Text>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg, justifyContent: 'center', padding: space.xl },
  brandBlock: { alignItems: 'center', marginBottom: space.xxxl },
  mark: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: `${color.gold}55`,
    backgroundColor: `${color.gold}14`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  markLetter: { color: color.gold, fontFamily: font.display, fontSize: 26 },
  title: { color: color.ink, fontFamily: font.display, fontSize: 32, letterSpacing: 0.3 },
  subtitle: { color: color.inkFaint, fontFamily: font.bodySemi, fontSize: 11, letterSpacing: 2.5, marginTop: space.sm },
  form: { gap: space.md },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  },
  inputWrapFocused: { borderColor: color.gold },
  input: { flex: 1, color: color.ink, fontFamily: font.body, fontSize: 15, paddingVertical: 0 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs },
  error: { color: color.danger, fontFamily: font.bodyMedium, fontSize: 13, flexShrink: 1 },
  submit: { marginTop: space.sm },
  footer: {
    color: color.inkFaint,
    fontFamily: font.body,
    fontSize: 12,
    textAlign: 'center',
    marginTop: space.xxxl,
  },
})
