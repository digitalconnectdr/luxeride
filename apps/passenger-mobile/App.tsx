import { useEffect, useState, useCallback, useMemo } from 'react'
import { View, StyleSheet, Text } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer, DefaultTheme, DarkTheme, type Theme } from '@react-navigation/native'
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
import { ThemeProvider, useTheme, useThemedStyles, font, type Palette } from './lib/theme'
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
import { NotificationsScreen } from './screens/NotificationsScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import type { BookingStackParamList, HomeStackParamList } from './lib/types'

const Tab = createBottomTabNavigator()
const BookingStack = createNativeStackNavigator<BookingStackParamList>()
// Inicio necesita su propio stack para poder abrir el centro de
// notificaciones desde la campana sin salirse de la pestaña.
const HomeStack = createNativeStackNavigator<HomeStackParamList>()

/** Opciones de header del stack — se recalculan al cambiar de tema. */
function useHeaderOptions() {
  const { c } = useTheme()
  return useMemo(
    () => ({
      headerStyle: { backgroundColor: c.bgElevated },
      headerShadowVisible: false,
      headerTintColor: c.ink,
      headerTitleStyle: { color: c.ink, fontFamily: font.bodySemi, fontSize: 16 },
    }),
    [c],
  )
}

function BookingStackScreen() {
  const header = useHeaderOptions()
  return (
    <BookingStack.Navigator screenOptions={header}>
      <BookingStack.Screen name="NewBooking" component={NewBookingScreen} options={{ title: 'Nueva reserva' }} />
      <BookingStack.Screen name="VehicleSelect" component={VehicleSelectScreen} options={{ title: 'Elige tu vehículo' }} />
      <BookingStack.Screen name="BookingConfirm" component={BookingConfirmScreen} options={{ title: 'Confirmación' }} />
      <BookingStack.Screen name="BookingSuccess" component={BookingSuccessScreen} options={{ title: '', headerBackVisible: false }} />
      <BookingStack.Screen name="TripTracking" component={TripTrackingScreen} options={{ title: 'Seguimiento en vivo' }} />
      <BookingStack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat con tu conductor' }} />
    </BookingStack.Navigator>
  )
}

function HomeStackScreen() {
  const header = useHeaderOptions()
  return (
    <HomeStack.Navigator screenOptions={header}>
      {/* Inicio trae su propia cabecera de marca dentro de la pantalla. */}
      <HomeStack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notificaciones' }} />
    </HomeStack.Navigator>
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
  const styles = useThemedStyles(makeStyles)
  const { c } = useTheme()
  const icons = TAB_ICON[routeName]
  return (
    <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
      <Ionicons name={focused ? icons.active : icons.inactive} size={22} color={focused ? c.gold : c.inkFaint} />
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

  // ThemeProvider por fuera de todo: el loader de fuentes ya necesita pintar
  // el fondo del tema correcto, no un blanco fijo.
  return (
    <ThemeProvider>
      <BrandingProvider>{fontsReady ? <AuthGate /> : <BootScreen />}</BrandingProvider>
    </ThemeProvider>
  )
}

function BootScreen() {
  const styles = useThemedStyles(makeStyles)
  return (
    <View style={styles.loading}>
      <ScreenLoader />
    </View>
  )
}

// Aparte del componente raíz para poder usar useBranding() (necesita estar
// DENTRO de BrandingProvider).
function AuthGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [roleError, setRoleError] = useState('')
  const { branding } = useBranding()
  const { c } = useTheme()
  const styles = useThemedStyles(makeStyles)

  // Tema de React Navigation — sin esto, el contenedor pinta su propio fondo
  // blanco durante las transiciones entre pantallas, con un flash claro en
  // medio de la app oscura.
  const navTheme = useMemo<Theme>(() => {
    const base = c.mode === 'dark' ? DarkTheme : DefaultTheme
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: c.gold,
        background: c.bg,
        card: c.bgElevated,
        text: c.ink,
        border: c.border,
      },
    }
  }, [c])

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

  const statusBarStyle = c.mode === 'dark' ? 'light' : 'dark'

  if (checkingSession) {
    return (
      <View style={styles.loading}>
        <StatusBar style={statusBarStyle} />
        <Text style={styles.loadingMark}>{branding.name}</Text>
        <ScreenLoader />
      </View>
    )
  }

  if (!session) {
    return (
      <>
        <StatusBar style={statusBarStyle} />
        <AuthScreen roleError={roleError} />
      </>
    )
  }

  const headerOptions = {
    headerStyle: { backgroundColor: c.bgElevated },
    headerShadowVisible: false,
    headerTintColor: c.ink,
    headerTitleStyle: { color: c.ink, fontFamily: font.bodySemi, fontSize: 16 },
  }

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={statusBarStyle} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: true,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: c.gold,
          tabBarInactiveTintColor: c.inkFaint,
          tabBarLabelStyle: styles.tabLabel,
          tabBarIcon: ({ focused }) => <TabIconView routeName={route.name} focused={focused} />,
        })}
      >
        {/* Inicio y Perfil traen su propia cabecera dentro de la pantalla
        (logo + campana / avatar), así que aquí van sin header nativo. */}
        <Tab.Screen name="Inicio" component={HomeStackScreen} />
        <Tab.Screen name="Reservar" component={BookingStackScreen} />
        <Tab.Screen
          name="Mis viajes"
          component={MyTripsScreen}
          options={{ headerShown: true, title: 'Mis viajes', ...headerOptions }}
        />
        <Tab.Screen name="Perfil" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  )
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    loading: { flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center', gap: 24 },
    loadingMark: { color: c.gold, fontFamily: font.display, fontSize: 22, letterSpacing: 1 },
    tabBar: {
      backgroundColor: c.bgElevated,
      borderTopColor: c.border,
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
    tabIconWrapActive: { backgroundColor: c.goldWash },
  })
