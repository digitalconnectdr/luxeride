import { useRef } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import SignatureScreen, { type SignatureViewRef } from 'react-native-signature-canvas'
import { Ionicons } from '@expo/vector-icons'
import { PressableScale } from './PressableScale'
import { SectionLabel } from './ui'
import { color, font, radius, space } from '../lib/theme'

export function SignaturePad({ onSave, onSkip }: { onSave: (base64: string) => void; onSkip: () => void }) {
  const ref = useRef<SignatureViewRef>(null)

  return (
    <View style={styles.container}>
      <SectionLabel>Firma del pasajero (opcional)</SectionLabel>
      <View style={styles.canvasWrap}>
        <SignatureScreen
          ref={ref}
          onOK={onSave}
          webStyle="body,html{background:#f6f2ea;margin:0;padding:0;} .m-signature-pad--footer{display:none;}"
          backgroundColor="#f6f2ea"
        />
      </View>
      <View style={styles.actions}>
        <PressableScale style={styles.secondaryButton} onPress={() => ref.current?.clearSignature()}>
          <Ionicons name="refresh" size={14} color={color.inkMuted} />
          <Text style={styles.secondaryButtonText}>Borrar</Text>
        </PressableScale>
        <PressableScale style={styles.secondaryButton} onPress={onSkip}>
          <Text style={styles.secondaryButtonText}>Omitir</Text>
        </PressableScale>
        <PressableScale style={styles.primaryButton} onPress={() => ref.current?.readSignature()} haptic="medium">
          <Ionicons name="checkmark" size={14} color={color.bg} />
          <Text style={styles.primaryButtonText}>Guardar firma</Text>
        </PressableScale>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: space.sm, marginTop: space.sm },
  canvasWrap: {
    height: 200,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.borderStrong,
    marginTop: space.xs,
  },
  actions: { flexDirection: 'row', gap: space.sm },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  secondaryButtonText: { color: color.inkMuted, fontFamily: font.bodySemi, fontSize: 13 },
  primaryButton: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    borderRadius: radius.sm,
    backgroundColor: color.gold,
  },
  primaryButtonText: { color: color.bg, fontFamily: font.bodyBold, fontSize: 13 },
})
