// ── Centro de ayuda del pasajero ───────────────────────────────────────────
// FAQ estático (no viene de la BD) por dos razones: funciona sin conexión —
// que es justo cuando alguien busca "¿cómo cancelo?" camino al aeropuerto — y
// no obliga al operador a redactar contenido para que la sección exista.
// Mismo enfoque que /admin/help, pero escrito para el pasajero.
//
// Debajo del FAQ van los dos caminos de contacto, deliberadamente separados:
//   · Soporte del SERVICIO  → la empresa operadora (su teléfono / email).
//   · Problema con la APP   → LuxeRide, vía feature_requests.
// Mezclarlos haría que un reclamo por un conductor tardío termine en la
// bandeja equivocada.

import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TextInput, Linking, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { callPassengerApi } from '../lib/api'
import { useBranding } from '../lib/branding'
import { PressableScale } from '../components/PressableScale'
import { Button, Card, SectionLabel } from '../components/ui'
import { font, radius, space, useThemedStyles, usePalette, type Palette } from '../lib/theme'

interface Faq {
  q: string
  a: string
}

const FAQS: Faq[] = [
  {
    q: '¿Cómo reservo un viaje?',
    a: 'Ve a la pestaña Reservar, escribe tu dirección de recogida y destino, elige cuándo lo necesitas y cuántos pasajeros van. Verás los vehículos disponibles con su precio antes de confirmar.',
  },
  {
    q: '¿Puedo reservar para otra persona?',
    a: 'Sí. En la pantalla de confirmación elige "Para otra persona" y escribe su nombre y teléfono. El viaje seguirá apareciendo en tu historial, pero el conductor contactará a quien viaja.',
  },
  {
    q: '¿Cuándo se me cobra?',
    a: 'Depende de lo que elijas al reservar: "Pagar ahora" cobra de una vez, "Tarjeta al finalizar" cobra automáticamente cuando el viaje termina, y "Efectivo" lo coordinas directamente con el conductor.',
  },
  {
    q: '¿Cómo sé quién me va a recoger?',
    a: 'Apenas se asigne un conductor recibirás una notificación. En Seguimiento en vivo verás su nombre, foto y calificación, además del vehículo con su placa y color.',
  },
  {
    q: '¿Cómo cancelo un viaje?',
    a: 'Abre el viaje desde Mis viajes y usa la opción de cancelar. Según la política de la empresa puede aplicar un cargo si cancelas muy cerca de la hora de recogida.',
  },
  {
    q: '¿Puedo hablar con mi conductor?',
    a: 'Sí. Desde Seguimiento en vivo puedes llamarlo o escribirle por chat, siempre que el viaje esté activo.',
  },
  {
    q: '¿Qué son las preferencias de viaje?',
    a: 'En Perfil → Preferencias de viaje puedes fijar si prefieres silencio o conversar, la temperatura, la música, si sueles necesitar ayuda con el equipaje, y notas fijas para el conductor. Se aplican a cada viaje que reserves.',
  },
  {
    q: 'Mi vuelo se retrasó, ¿qué hago?',
    a: 'Si agregaste tu número de vuelo al reservar, el sistema sigue el estado del vuelo y avisa a la empresa. Aun así, escríbele al conductor por chat para confirmar la nueva hora.',
  },
]

export function HelpScreen() {
  const styles = useThemedStyles(makeStyles)
  const c = usePalette()
  const { branding } = useBranding()
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const [reportOpen, setReportOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const supportPhone = branding.supportPhone
  const supportEmail = branding.supportEmail

  async function sendReport() {
    setError('')
    if (!title.trim() || !description.trim()) {
      setError('Escribe un título y una descripción.')
      return
    }
    setSending(true)
    const result = await callPassengerApi('feedback', {
      type: 'bug',
      title: title.trim(),
      description: description.trim(),
    })
    setSending(false)
    if (!result.success) {
      setError(result.error ?? 'No se pudo enviar. Intenta de nuevo.')
      return
    }
    setTitle('')
    setDescription('')
    setReportOpen(false)
    Alert.alert('Gracias', 'Recibimos tu reporte. El equipo de la app lo va a revisar.')
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <SectionLabel>Preguntas frecuentes</SectionLabel>
      <View style={styles.faqList}>
        {FAQS.map((faq, i) => {
          const open = openIndex === i
          return (
            <PressableScale key={faq.q} onPress={() => setOpenIndex(open ? null : i)} haptic="light">
              <View style={[styles.faqCard, open && styles.faqCardOpen]}>
                <View style={styles.faqHeader}>
                  <Text style={styles.faqQuestion}>{faq.q}</Text>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={c.inkFaint} />
                </View>
                {open && <Text style={styles.faqAnswer}>{faq.a}</Text>}
              </View>
            </PressableScale>
          )
        })}
      </View>

      {/* Soporte del SERVICIO — va a la empresa operadora. */}
      <SectionLabel>Soporte de {branding.name}</SectionLabel>
      <Card style={styles.panel}>
        <Text style={styles.hint}>
          Para dudas sobre tu viaje, cobros o el servicio, contacta directamente a la empresa.
        </Text>
        {supportPhone ? (
          <Button
            label="Llamar"
            icon="call-outline"
            variant="secondary"
            onPress={() => Linking.openURL(`tel:${supportPhone}`)}
          />
        ) : null}
        {supportEmail ? (
          <Button
            label="Enviar correo"
            icon="mail-outline"
            variant="secondary"
            onPress={() => Linking.openURL(`mailto:${supportEmail}`)}
          />
        ) : null}
        {!supportPhone && !supportEmail && (
          <Text style={styles.hint}>
            Esta empresa aún no publicó un contacto de soporte. Escríbele a tu conductor por chat durante el viaje.
          </Text>
        )}
      </Card>

      {/* Problema con la APP — va a LuxeRide, no a la operadora. */}
      <SectionLabel>¿Algo no funciona en la app?</SectionLabel>
      <Card style={styles.panel}>
        {!reportOpen ? (
          <>
            <Text style={styles.hint}>
              Si algo falla o se ve mal en la aplicación, cuéntanos. Esto llega al equipo que desarrolla la app, no a
              la empresa de transporte.
            </Text>
            <Button label="Reportar un problema" icon="bug-outline" variant="secondary" onPress={() => setReportOpen(true)} />
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="¿Qué pasó? (resumen corto)"
              placeholderTextColor={c.inkFaint}
              value={title}
              onChangeText={setTitle}
              maxLength={200}
            />
            <TextInput
              style={styles.textarea}
              placeholder="Cuéntanos con detalle: qué hiciste, qué esperabas y qué pasó."
              placeholderTextColor={c.inkFaint}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={2000}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.actions}>
              <PressableScale onPress={() => { setReportOpen(false); setError('') }}>
                <Text style={styles.cancel}>Cancelar</Text>
              </PressableScale>
              <Button label="Enviar" icon="send" onPress={sendReport} loading={sending} style={styles.sendBtn} />
            </View>
          </>
        )}
      </Card>
    </ScrollView>
  )
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scroll: { padding: space.lg, gap: space.md, paddingBottom: space.xxxl },
    faqList: { gap: space.sm },
    faqCard: {
      backgroundColor: c.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
      gap: space.sm,
    },
    faqCardOpen: { borderColor: c.borderGold },
    faqHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    faqQuestion: { flex: 1, color: c.ink, fontFamily: font.bodyMedium, fontSize: 14 },
    faqAnswer: { color: c.inkMuted, fontFamily: font.body, fontSize: 13, lineHeight: 19 },
    panel: { gap: space.md },
    hint: { color: c.inkFaint, fontFamily: font.body, fontSize: 12.5, lineHeight: 18 },
    input: {
      color: c.ink,
      fontFamily: font.body,
      fontSize: 14,
      backgroundColor: c.surfaceRaised,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
    },
    textarea: {
      color: c.ink,
      fontFamily: font.body,
      fontSize: 14,
      backgroundColor: c.surfaceRaised,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      padding: space.md,
      minHeight: 96,
      textAlignVertical: 'top',
    },
    error: { color: c.danger, fontFamily: font.bodyMedium, fontSize: 12 },
    actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
    cancel: { color: c.inkFaint, fontFamily: font.bodyMedium, fontSize: 13 },
    sendBtn: { flex: 1 },
  })
