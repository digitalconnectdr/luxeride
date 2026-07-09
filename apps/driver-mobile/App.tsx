import { useEffect, useState } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { LoginScreen } from './screens/LoginScreen'
import { TripScreen } from './screens/TripScreen'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCheckingSession(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

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
      {session ? <TripScreen /> : <LoginScreen />}
    </>
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#1d1b18', justifyContent: 'center', alignItems: 'center' },
})
