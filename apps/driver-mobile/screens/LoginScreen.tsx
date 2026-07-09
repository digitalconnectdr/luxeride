import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { supabase } from '../lib/supabase'

export function LoginScreen({ roleError }: { roleError?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function signIn() {
    setError('')
    setLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (signInError) setError(signInError.message)
  }

  const displayError = error || roleError

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LuxeRide</Text>
      <Text style={styles.subtitle}>Portal del conductor</Text>

      <TextInput
        style={styles.input}
        placeholder="Correo"
        placeholderTextColor="#75716a"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        placeholderTextColor="#75716a"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {displayError ? <Text style={styles.error}>{displayError}</Text> : null}

      <Pressable style={styles.button} onPress={signIn} disabled={loading}>
        {loading ? <ActivityIndicator color="#1d1b18" /> : <Text style={styles.buttonText}>Iniciar sesión</Text>}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1d1b18', justifyContent: 'center', padding: 24 },
  title: { color: '#f5f2ec', fontSize: 28, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: '#8a6520', fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 32, letterSpacing: 1 },
  input: {
    backgroundColor: '#2a2723',
    color: '#f5f2ec',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  error: { color: '#e57373', textAlign: 'center', marginBottom: 12, fontSize: 13 },
  button: { backgroundColor: '#e9c176', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#1d1b18', fontWeight: '700', fontSize: 16 },
})
