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
import { registerForPushNotifications } from './lib/push'
import { BrandingProvider, useBranding } from './lib/branding'
import { color, font } from './lib/theme'
import { ScreenLoader } from './components/ui'
import { AuthScreen } from './screens/AuthScreen'
import { HomeScreen } from './screens/HomeScreen'
import { NewBookingScreen } from './screens/NewBookingScreen'
import { VehicleSelectScreen } from './screens/VehicleSelectScreen'
import { BookingConfirmScreen } from './screens/BookingConfirmScreen'
import { BookingSuccessScreen } from './screens/BookingSuccessScreen'
import { TripTrackingScreen } from './screens/TripTrackingScreen'
import { ChatScreen } from './screens/ChatScreen'
import { MyTripsScreen } from './screens/MyTripsScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import type { BookingStackParamList } from './lib/types'

const Tab = createBottomTabNavigator()
const BookingStack = createNativeStackNavigator<BookingStackParamList>()

const lightHeader = {
  headerStyle: { backgroundColor: color.bgElevated },
  headerShadowVisible: false,
  headerTintColor: color.ink,
  headerTitleStyle: { color: color.ink, fontFamily: font.bodySemi, fontSize: 16 },
}

function BookingStackScreen() {
  return (
    <BookingStack.Navigator screenOptions={lightHeader}>
      <BookingStack.Screen name="NewBooking" component={NewBookingScreen} options={{ title: 'Nueva reserva' }} />
      <BookingStack.Screen name="VehicleSelect" component={VehicleSelectScreen} options={{ title: 'Elige tu vehículo' }} />
      <BookingStack.Screen name="BookingConfirm" component={BookingConfirmScreen} options={{ title: 'Confirmar' }} />
      <BookingStack.Screen name="BookingSuccess" component={BookingSuccessScreen} options={{ title: '', headerBackVisible: false }} />
      <BookingStack.Screen name="TripTracking" component={TripTrackingScreen} options={{ title: 'Tu viaje' }} />
      <BookingStack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat con tu conductor' }} />
    </BookingStack.Navigator>
  )
}

type TabIcon = { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
const TAB_ICON: Record<string, TabIcon> = {
  Inicio: { active: 'home', inactive: 'home-outline' },
  Reservar: { active: 'car-sport', inactive: 'car-sport-outline' },
  'Mis viajes': { active: 'time', inactive: 'time-outline' },
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
  const [fontsReady] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_600SemiBold_Italic,
  })

  if (!fontsReady) {
    return (
      <View style={styles.loading}>
        <ScreenLoader />
      </View>
    )
  }

  return (
    <BrandingProvider>
      <AuthGate />
    </BrandingProvider>
  )
}

// Aparte del componente raíz para poder usar useBranding() (necesita estar
// DENTRO de BrandingProvider).
function AuthGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [roleError, setRoleError] = useState('')
  const { branding } = useBranding()

  // Esta app es SOLO para pasajeros. Mismo patrón que driver-mobile: la
  // validación de rol pasa ANTES de poner `session` en un valor no nulo, así
  // nunca se muestra la navegación para una cuenta con rol incorrecto.
  const validatePassengerSession = useCallback(async (candidate: Session | null) => {
    if (!candidate) {
      setSession(null)
      return
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', candidate.user.id)
      .single()

    if (profile?.role !== 'customer') {
      setRoleError('Esta app es solo para pasajeros.')
      await supabase.auth.signOut()
      setSession(null)
      return
    }

    setRoleError('')
    setSession(candidate)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      validatePassengerSession(data.session).finally(() => setCheckingSession(false))
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      validatePassengerSession(newSession)
    })

    return () => subscription.subscription.unsubscribe()
  }, [validatePassengerSession])

  // Se registra recién con sesión de pasajero YA validada (no antes) — pedir
  // el permiso de notificaciones en la pantalla de login no tendría a quién
  // asociarle el token todavía.
  useEffect(() => {
    if (session) registerForPushNotifications(session.user.id)
  }, [session])

  if (checkingSession) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingMark}>{branding.name}</Text>
        <ScreenLoader />
      </View>
    )
  }

  if (!session) {
    return (
      <>
        <StatusBar style="dark" />
        <AuthScreen roleError={roleError} />
      </>
    )
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: true,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: color.gold,
          tabBarInactiveTintColor: color.inkFaint,
          tabBarLabelStyle: styles.tabLabel,
          tabBarIcon: ({ focused }) => <TabIconView routeName={route.name} focused={focused} />,
        })}
      >
        <Tab.Screen name="Inicio" component={HomeScreen} options={{ headerShown: true, title: 'Inicio', ...lightHeader }} />
        <Tab.Screen name="Reservar" component={BookingStackScreen} />
        <Tab.Screen name="Mis viajes" component={MyTripsScreen} options={{ headerShown: true, title: 'Mis viajes', ...lightHeader }} />
        <Tab.Screen name="Perfil" component={ProfileScreen} options={{ headerShown: true, title: 'Perfil', ...lightHeader }} />
      </Tab.Navigator>
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: color.bg, justifyContent: 'center', alignItems: 'center', gap: 24 },
  loadingMark: { color: color.gold, fontFamily: font.display, fontSize: 22, letterSpacing: 1 },
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
