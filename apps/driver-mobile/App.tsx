import { useEffect, useState, useCallback } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { LoginScreen } from './screens/LoginScreen'
import { TripScreen } from './screens/TripScreen'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [roleError, setRoleError] = useState('')

  // Esta app es SOLO para conductores. La validación de rol pasa AQUÍ, antes
  // de que `session` se ponga en un valor no nulo — así nunca llegamos a
  // mostrar (ni remontar) TripScreen para una cuenta que no sea driver, y el
  // mensaje de error queda visible en el login en vez de desaparecer junto
  // con la pantalla que lo mostraba.
  const validateDriverSession = useCallback(async (candidate: Session | null) => {
    if (!candidate) {
      setSession(null)
      return
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', candidate.user.id)
      .single()

    if (profile?.role !== 'driver') {
      setRoleError('Esta app es solo para conductores.')
      await supabase.auth.signOut()
      setSession(null)
      return
    }

    setRoleError('')
    setSession(candidate)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      validateDriverSession(data.session).finally(() => setCheckingSession(false))
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      validateDriverSession(newSession)
    })

    return () => subscription.subscription.unsubscribe()
  }, [validateDriverSession])

  if (checkingSession) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#e9c176" />
      </View>
    )
  }

  return (
    <>
      <StatusBar style="light" />
      {session ? <TripScreen /> : <LoginScreen roleError={roleError} />}
    </>
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#1d1b18', justifyContent: 'center', alignItems: 'center' },
})
