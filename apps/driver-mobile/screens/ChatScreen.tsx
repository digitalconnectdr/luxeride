import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { callDriverApi } from '../lib/api'
import { PressableScale } from '../components/PressableScale'
import { ScreenLoader, EmptyState } from '../components/ui'
import { color, font, radius, space } from '../lib/theme'
import type { TripMessage, TripsStackParamList } from '../lib/types'

type Props = NativeStackScreenProps<TripsStackParamList, 'Chat'>

export function ChatScreen({ route }: Props) {
  const { tripId } = route.params
  const [messages, setMessages] = useState<TripMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const companyIdRef = useRef<string | null>(null)
  const listRef = useRef<FlatList<TripMessage>>(null)

  const load = useCallback(async () => {
    const { data: booking } = await supabase.from('bookings').select('company_id').eq('id', tripId).maybeSingle()
    companyIdRef.current = booking?.company_id ?? null

    const { data } = await supabase
      .from('trip_messages')
      .select('id, sender, body, created_at, read_at')
      .eq('booking_id', tripId)
      .order('created_at', { ascending: true })
      .limit(200)
    setMessages((data as TripMessage[] | null) ?? [])
    setLoading(false)
    callDriverApi('mark-messages-read', { bookingId: tripId })
  }, [tripId])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  // Realtime: nuevos mensajes de ambos lados llegan por acá, incluyendo el
  // propio (no se agrega optimista al enviar — evita duplicados).
  useEffect(() => {
    const channel = supabase
      .channel(`trip-messages-${tripId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trip_messages', filter: `booking_id=eq.${tripId}` },
        (payload) => {
          const message = payload.new as TripMessage
          setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]))
          if (message.sender === 'client') {
            callDriverApi('mark-messages-read', { bookingId: tripId })
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tripId])

  async function send() {
    const body = text.trim()
    if (!body || !companyIdRef.current || sending) return
    setSending(true)
    setText('')
    await supabase.from('trip_messages').insert({
      booking_id: tripId,
      company_id: companyIdRef.current,
      sender: 'driver',
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
          <EmptyState icon="chatbubble-outline" title="Sin mensajes todavía" subtitle="Escribe abajo para coordinar con el pasajero." />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View style={[styles.bubbleRow, item.sender === 'driver' && styles.bubbleRowDriver]}>
              <View style={[styles.bubble, item.sender === 'driver' ? styles.bubbleDriver : styles.bubbleClient]}>
                <Text style={[styles.bubbleText, item.sender === 'driver' && styles.bubbleTextDriver]}>{item.body}</Text>
                <Text style={[styles.bubbleTime, item.sender === 'driver' && styles.bubbleTimeDriver]}>
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
          placeholderTextColor={color.inkFaint}
          value={text}
          onChangeText={setText}
          multiline
        />
        <PressableScale style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]} onPress={send} disabled={!text.trim() || sending} haptic="light">
          <Ionicons name="send" size={17} color={color.bg} />
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  emptyWrap: { flex: 1, justifyContent: 'center' },
  list: { padding: space.xl, gap: space.sm, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowDriver: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  bubbleClient: { backgroundColor: color.surfaceRaised, borderBottomLeftRadius: 4 },
  bubbleDriver: { backgroundColor: color.gold, borderBottomRightRadius: 4 },
  bubbleText: { color: color.ink, fontFamily: font.body, fontSize: 14, lineHeight: 19 },
  bubbleTextDriver: { color: color.bg },
  bubbleTime: { color: color.inkFaint, fontFamily: font.body, fontSize: 10, marginTop: 4, textAlign: 'right' },
  bubbleTimeDriver: { color: `${color.bg}99` },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    padding: space.lg,
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.bgElevated,
  },
  input: {
    flex: 1,
    backgroundColor: color.surface,
    color: color.ink,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontFamily: font.body,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: color.gold, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.4 },
})
