import { useCallback, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Switch } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { callDriverApi } from '../lib/api'

export function ProfileScreen() {
  const [email, setEmail] = useState('')
  const [isAvailable, setIsAvailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    setEmail(user.email ?? '')
    const { data } = await supabase.from('drivers').select('is_available').eq('id', user.id).maybeSingle()
    setIsAvailable(data?.is_available ?? false)
    setLoading(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  async function toggleAvailability(value: boolean) {
    setIsAvailable(value) // optimista
    setSaving(true)
    const result = await callDriverApi('set-availability', { isAvailable: value })
    setSaving(false)
    if (!result.success) setIsAvailable(!value) // revertir si falla
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#e9c176" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.email}>{email}</Text>
        <Text style={styles.role}>Conductor</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>En servicio</Text>
            <Text style={styles.rowSubtitle}>
              {isAvailable ? 'Puedes recibir nuevas asignaciones' : 'No recibirás nuevas asignaciones'}
            </Text>
          </View>
          {saving ? (
            <ActivityIndicator color="#e9c176" />
          ) : (
            <Switch
              value={isAvailable}
              onValueChange={toggleAvailability}
              trackColor={{ false: '#3a352e', true: '#8a6520' }}
              thumbColor={isAvailable ? '#e9c176' : '#75716a'}
            />
          )}
        </View>
      </View>

      <Pressable style={styles.signOut} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.signOutText}>Cerrar sesión</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1d1b18', padding: 20, paddingTop: 12, gap: 14 },
  center: { flex: 1, backgroundColor: '#1d1b18', justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#2a2723', borderRadius: 16, padding: 18 },
  email: { color: '#f5f2ec', fontSize: 16, fontWeight: '700' },
  role: { color: '#8a6520', fontSize: 12, marginTop: 4, letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowText: { flex: 1, marginRight: 12 },
  rowTitle: { color: '#f5f2ec', fontSize: 15, fontWeight: '600' },
  rowSubtitle: { color: '#a8a39a', fontSize: 12, marginTop: 2 },
  signOut: { marginTop: 'auto', alignItems: 'center', paddingVertical: 14 },
  signOutText: { color: '#75716a', fontSize: 14 },
})
