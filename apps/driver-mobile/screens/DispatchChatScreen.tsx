// ── Chat Dispatch ↔ Conductor (canal general, no atado a un viaje) ─────────
// Espejo de ChatScreen.tsx (trip_messages) pero sobre driver_messages — un
// canal por conductor que Dispatch usa para contactarlo aunque no tenga un
// viaje activo (ver migración 24 + web: DriverChannelChat en /driver/trips).
// Esta pantalla no existía en la app nativa — el conductor solo podía leer
// estos mensajes desde la PWA web, nunca desde el móvil.

import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { PressableScale } from '../components/PressableScale'
import { ScreenLoader, EmptyState } from '../components/ui'
import { color, font, radius, space } from '../lib/theme'

interface DriverChannelMessage {
  id: string
  sender: 'dispatch' | 'driver'
  sender_name: string | null
  body: string
  created_at: string
  read_at: string | null
}

export function DispatchChatScreen() {
  const [messages, setMessages] = useState<DriverChannelMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const driverIdRef = useRef<string | null>(null)
  const companyIdRef = useRef<string | null>(null)
  const listRef = useRef<FlatList<DriverChannelMessage>>(null)

  const markDispatchRead = useCallback(() => {
    if (!driverIdRef.current) return
    supabase
      .from('driver_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('driver_id', driverIdRef.current)
      .eq('sender', 'dispatch')
      .is('read_at', null)
      .then(() => {})
  }, [])

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    driverIdRef.current = user.id

    const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).maybeSingle()
    companyIdRef.current = profile?.company_id ?? null

    const { data } = await supabase
      .from('driver_messages')
      .select('id, sender, sender_name, body, created_at, read_at')
      .eq('driver_id', user.id)
      .order('created_at', { ascending: true })
      .limit(200)
    setMessages((data as DriverChannelMessage[] | null) ?? [])
    setLoading(false)
    markDispatchRead()
  }, [markDispatchRead])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  // Realtime: mensajes nuevos de ambos lados, igual que ChatScreen.tsx.
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    // El fetch del usuario es async — si la pantalla se desmonta antes de que
    // resuelva, `cancelled` evita suscribirse a un canal que ya nadie va a
    // limpiar (el cleanup de abajo corre con channel todavía en null).
    let cancelled = false
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return
      channel = supabase
        .channel(`driver-messages-${user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'driver_messages', filter: `driver_id=eq.${user.id}` },
          (payload) => {
            const message = payload.new as DriverChannelMessage
            setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]))
            if (message.sender === 'dispatch') markDispatchRead()
          },
        )
        .subscribe()
    })()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [markDispatchRead])

  async function send() {
    const body = text.trim()
    if (!body || !driverIdRef.current || !companyIdRef.current || sending) return
    setSending(true)
    setText('')
    const { error } = await supabase.from('driver_messages').insert({
      driver_id: driverIdRef.current,
      company_id: companyIdRef.current,
      sender: 'driver',
      body,
    })
    setSending(false)
    if (error) {
      setText(body)
    }
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
          <EmptyState icon="chatbubbles-outline" title="Sin mensajes todavía" subtitle="Aquí verás los mensajes de Dispatch, aunque no tengas un viaje activo." />
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
          placeholder="Escribe un mensaje a Dispatch..."
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
