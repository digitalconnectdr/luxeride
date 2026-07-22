// ── Perfil — mínimo viable (Sprint 1: solo cerrar sesión) ──────────────────
// Datos personales/direcciones guardadas llegan en Sprint 4.

import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useBranding } from '../lib/branding'
import { BrandMark } from '../components/BrandMark'
import { Button, Card } from '../components/ui'
import { color, font, space } from '../lib/theme'

export function ProfileScreen() {
  const { branding } = useBranding()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return
      setEmail(auth.user.email ?? '')
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name')
        .eq('id', auth.user.id)
        .single()
      if (profile) setName(`${profile.first_name} ${profile.last_name}`.trim())
    }
    load()
  }, [])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BrandMark size={64} />
        <Text style={styles.name}>{name || 'Pasajero'}</Text>
        <Text style={styles.email}>{email}</Text>
      </View>

      <Card style={styles.card}>
        <View style={styles.infoRow}>
          <Ionicons name="business-outline" size={18} color={color.inkFaint} />
          <Text style={styles.infoText}>Viajando con {branding.name}</Text>
        </View>
      </Card>

      <Button
        label="Cerrar sesión"
        variant="secondary"
        icon="log-out-outline"
        onPress={() => supabase.auth.signOut()}
        style={styles.signOut}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg, padding: space.lg, gap: space.lg },
  header: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  name: { color: color.ink, fontFamily: font.display, fontSize: 22 },
  email: { color: color.inkFaint, fontFamily: font.body, fontSize: 13 },
  card: { flexDirection: 'row' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  infoText: { color: color.ink, fontFamily: font.bodyMedium, fontSize: 14 },
  signOut: { marginTop: 'auto' },
})
