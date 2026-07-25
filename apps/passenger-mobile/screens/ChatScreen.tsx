// ── Chat con el conductor (viaje activo) ────────────────────────────────────
// Mismo patrón que apps/driver-mobile/screens/ChatScreen.tsx: acceso directo
// a Supabase (no una ruta /api/mobile/passenger/*) gracias a la RLS de la
// migración 71 (customers_read/write_trip_messages) — el pasajero de la app
// SÍ tiene sesión, a diferencia del guest de la web que necesita pasar por
// server actions con service role.

import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { PressableScale } from '../components/PressableScale'
import { ScreenLoader, EmptyState } from '../components/ui'
import { font, radius, space, useThemedStyles, usePalette, type Palette } from '../lib/theme'
import type { BookingStackParamList, TripMessage } from '../lib/types'

type Props = NativeStackScreenProps<BookingStackParamList, 'Chat'>

export function ChatScreen({ route }: Props) {
  const { bookingId } = route.params
  const styles = useThemedStyles(makeStyles)
  const c = usePalette()
  const [messages, setMessages] = useState<TripMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const companyIdRef = useRef<string | null>(null)
  const listRef = useRef<FlatList<TripMessage>>(null)

  const load = useCallback(async () => {
    const { data: booking } = await supabase.from('bookings').select('company_id').eq('id', bookingId).maybeSingle()
    companyIdRef.current = booking?.company_id ?? null

    const { data } = await supabase
      .from('trip_messages')
      .select('id, sender, body, created_at, read_at')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true })
      .limit(200)
    setMessages((data as TripMessage[] | null) ?? [])
    setLoading(false)
  }, [bookingId])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  // Realtime: mensajes nuevos de ambos lados llegan por acá, incluyendo el
  // propio (no se agrega optimista al enviar — evita duplicados).
  useEffect(() => {
    const channel = supabase
      .channel(`trip-messages-${bookingId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trip_messages', filter: `booking_id=eq.${bookingId}` },
        (payload) => {
          const message = payload.new as TripMessage
          setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [bookingId])

  async function send() {
    const body = text.trim()
    if (!body || !companyIdRef.current || sending) return
    setSending(true)
    setText('')
    await supabase.from('trip_messages').insert({
      booking_id: bookingId,
      company_id: companyIdRef.current,
      sender: 'client',
      body,
    })
    setSending(false)
  }

  if (loading) return <ScreenLoader />

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      {messages.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState icon="chatbubble-outline" title="Sin mensajes todavía" subtitle="Escribe abajo para coordinar con tu conductor." />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View style={[styles.bubbleRow, item.sender === 'client' && styles.bubbleRowClient]}>
              <View style={[styles.bubble, item.sender === 'client' ? styles.bubbleClient : styles.bubbleDriver]}>
                <Text style={[styles.bubbleText, item.sender === 'client' && styles.bubbleTextClient]}>{item.body}</Text>
                <Text style={[styles.bubbleTime, item.sender === 'client' && styles.bubbleTimeClient]}>
                  {new Date(item.created_at).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Escribe un mensaje..."
          placeholderTextColor={c.inkFaint}
          value={text}
          onChangeText={setText}
          multiline
        />
        <PressableScale style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]} onPress={send} disabled={!text.trim() || sending} haptic="light">
          <Ionicons name="send" size={17} color={c.bg} />
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  )
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  emptyWrap: { flex: 1, justifyContent: 'center' },
  list: { padding: space.xl, gap: space.sm, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowClient: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  bubbleDriver: { backgroundColor: c.surfaceRaised, borderBottomLeftRadius: 4 },
  bubbleClient: { backgroundColor: c.gold, borderBottomRightRadius: 4 },
  bubbleText: { color: c.ink, fontFamily: font.body, fontSize: 14, lineHeight: 19 },
  bubbleTextClient: { color: c.bg },
  bubbleTime: { color: c.inkFaint, fontFamily: font.body, fontSize: 10, marginTop: 4, textAlign: 'right' },
  bubbleTimeClient: { color: `${c.bg}99` },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    padding: space.lg,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.bgElevated,
  },
  input: {
    flex: 1,
    backgroundColor: c.surface,
    color: c.ink,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontFamily: font.body,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: c.gold, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.4 },
  })
