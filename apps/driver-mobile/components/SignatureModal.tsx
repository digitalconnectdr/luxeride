// ── Firma del pasajero — como modal de pantalla completa ───────────────────
// Antes vivía inline dentro del ScrollView de "Completar viaje": el gesto de
// dibujar competía con el scroll del padre y el trazo se movía en vez de
// dibujar. Un Modal renderiza en su propia jerarquía nativa, fuera del
// ScrollView — el lienzo recibe el gesto completo sin competencia.

import { useRef } from 'react'
import { Modal, View, Text, StyleSheet } from 'react-native'
import SignatureScreen, { type SignatureViewRef } from 'react-native-signature-canvas'
import { Ionicons } from '@expo/vector-icons'
import { PressableScale } from './PressableScale'
import { color, font, radius, space } from '../lib/theme'

export function SignatureModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean
  onClose: () => void
  onSave: (base64: string) => void
}) {
  const ref = useRef<SignatureViewRef>(null)

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Firma del pasajero</Text>
          <PressableScale onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={20} color={color.inkMuted} />
          </PressableScale>
        </View>
        <Text style={styles.hint}>Entrega el teléfono al pasajero para que firme abajo.</Text>

        <View style={styles.canvasWrap}>
          <SignatureScreen
            ref={ref}
            onOK={(sig) => {
              onSave(sig)
              onClose()
            }}
            webStyle={`body,html{background:${color.ink};margin:0;padding:0;} .m-signature-pad--footer{display:none;}`}
            backgroundColor={color.ink}
          />
        </View>

        <View style={styles.actions}>
          <PressableScale style={styles.secondaryButton} onPress={() => ref.current?.clearSignature()}>
            <Ionicons name="refresh" size={16} color={color.inkMuted} />
            <Text style={styles.secondaryButtonText}>Borrar</Text>
          </PressableScale>
          <PressableScale style={styles.secondaryButton} onPress={onClose}>
            <Text style={styles.secondaryButtonText}>Omitir</Text>
          </PressableScale>
          <PressableScale style={styles.primaryButton} onPress={() => ref.current?.readSignature()} haptic="medium">
            <Ionicons name="checkmark" size={16} color={color.bg} />
            <Text style={styles.primaryButtonText}>Guardar firma</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg, padding: space.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.md },
  title: { color: color.ink, fontFamily: font.displaySemi, fontSize: 20 },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { color: color.inkFaint, fontFamily: font.body, fontSize: 13, marginTop: space.sm, marginBottom: space.lg },
  canvasWrap: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.lg, marginBottom: space.md },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  secondaryButtonText: { color: color.inkMuted, fontFamily: font.bodySemi, fontSize: 14 },
  primaryButton: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    borderRadius: radius.md,
    backgroundColor: color.gold,
  },
  primaryButtonText: { color: color.bg, fontFamily: font.bodyBold, fontSize: 14 },
})
