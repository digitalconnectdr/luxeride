import { useEffect, useState, useCallback } from 'react'
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { LoginScreen } from './screens/LoginScreen'
import { TripsListScreen } from './screens/TripsListScreen'
import { TripDetailScreen } from './screens/TripDetailScreen'
import { EarningsScreen } from './screens/EarningsScreen'
import { DocumentsScreen } from './screens/DocumentsScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import type { TripsStackParamList } from './lib/types'

const Tab = createBottomTabNavigator()
const TripsStack = createNativeStackNavigator<TripsStackParamList>()

const darkHeader = {
  headerStyle: { backgroundColor: '#1d1b18' },
  headerTintColor: '#f5f2ec',
  headerTitleStyle: { color: '#f5f2ec' },
}

function TripsStackScreen() {
  return (
    <TripsStack.Navigator screenOptions={darkHeader}>
      <TripsStack.Screen name="TripsList" component={TripsListScreen} options={{ title: 'Hoy' }} />
      <TripsStack.Screen name="TripDetail" component={TripDetailScreen} options={{ title: 'Viaje' }} />
    </TripsStack.Navigator>
  )
}

const TAB_ICON: Record<string, string> = {
  Hoy: '🚗',
  Ganancias: '💰',
  Documentos: '📄',
  Perfil: '👤',
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [roleError, setRoleError] = useState('')

  // Esta app es SOLO para conductores. La validación de rol pasa AQUÍ, antes
  // de que `session` se ponga en un valor no nulo — así nunca llegamos a
  // mostrar la navegación para una cuenta que no sea driver, y el mensaje de
  // error queda visible en el login en vez de desaparecer junto con la
  // pantalla que lo mostraba.
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

  if (!session) {
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen roleError={roleError} />
      </>
    )
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: route.name !== 'Hoy',
          ...darkHeader,
          tabBarStyle: { backgroundColor: '#2a2723', borderTopColor: '#3a352e' },
          tabBarActiveTintColor: '#e9c176',
          tabBarInactiveTintColor: '#75716a',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>{TAB_ICON[route.name]}</Text>,
        })}
      >
        <Tab.Screen name="Hoy" component={TripsStackScreen} />
        <Tab.Screen name="Ganancias" component={EarningsScreen} />
        <Tab.Screen name="Documentos" component={DocumentsScreen} />
        <Tab.Screen name="Perfil" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#1d1b18', justifyContent: 'center', alignItems: 'center' },
})
