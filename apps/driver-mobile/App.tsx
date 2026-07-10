import { useEffect, useState, useCallback } from 'react'
import { View, StyleSheet, Text } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { useFonts } from 'expo-font'
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter'
import {
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_600SemiBold_Italic,
} from '@expo-google-fonts/playfair-display'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { useDriverPresenceReporter } from './lib/presenceReporter'
import { color, font } from './lib/theme'
import { ScreenLoader } from './components/ui'
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
  headerStyle: { backgroundColor: color.bg },
  headerShadowVisible: false,
  headerTintColor: color.ink,
  headerTitleStyle: { color: color.ink, fontFamily: font.bodySemi, fontSize: 16 },
}

function TripsStackScreen() {
  return (
    <TripsStack.Navigator screenOptions={darkHeader}>
      <TripsStack.Screen name="TripsList" component={TripsListScreen} options={{ title: 'Hoy' }} />
      <TripsStack.Screen name="TripDetail" component={TripDetailScreen} options={{ title: 'Viaje' }} />
    </TripsStack.Navigator>
  )
}

type TabIcon = { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
const TAB_ICON: Record<string, TabIcon> = {
  Hoy: { active: 'car-sport', inactive: 'car-sport-outline' },
  Ganancias: { active: 'wallet', inactive: 'wallet-outline' },
  Documentos: { active: 'document-text', inactive: 'document-text-outline' },
  Perfil: { active: 'person-circle', inactive: 'person-circle-outline' },
}

function TabIconView({ routeName, focused }: { routeName: string; focused: boolean }) {
  const icons = TAB_ICON[routeName]
  return (
    <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
      <Ionicons name={focused ? icons.active : icons.inactive} size={22} color={focused ? color.gold : color.inkFaint} />
    </View>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [roleError, setRoleError] = useState('')

  // Un solo useFonts (importado directo de expo-font, NO del re-export de
  // @expo-google-fonts/*) — esos paquetes quedan hoisteados en la raíz del
  // monorepo y su propio hook interno termina resolviendo una copia de React
  // distinta a la que usa esta app, lo que rompía los hooks en el teléfono.
  const [fontsReady] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_600SemiBold_Italic,
  })

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

  if (checkingSession || !fontsReady) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingMark}>LuxeRide</Text>
        <ScreenLoader />
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

  return <DriverApp />
}

// Aparte para que useDriverPresenceReporter (que arranca su propio watch de
// GPS) solo se monte cuando ya hay sesión válida de conductor — nunca en la
// pantalla de login.
function DriverApp() {
  useDriverPresenceReporter()

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: route.name !== 'Hoy',
          ...darkHeader,
          tabBarShowLabel: true,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: color.gold,
          tabBarInactiveTintColor: color.inkFaint,
          tabBarLabelStyle: styles.tabLabel,
          tabBarIcon: ({ focused }) => <TabIconView routeName={route.name} focused={focused} />,
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
  loading: { flex: 1, backgroundColor: color.bg, justifyContent: 'center', alignItems: 'center', gap: 24 },
  loadingMark: { color: color.gold, fontSize: 22, letterSpacing: 1, fontWeight: '600' },
  tabBar: {
    backgroundColor: color.bgElevated,
    borderTopColor: color.border,
    borderTopWidth: 1,
    height: 84,
    paddingTop: 10,
  },
  tabLabel: { fontFamily: font.bodyMedium, fontSize: 11, marginTop: 2 },
  tabIconWrap: {
    width: 40,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapActive: { backgroundColor: `${color.gold}1c` },
})
