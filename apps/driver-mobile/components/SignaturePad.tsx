import { useRef } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import SignatureScreen, { type SignatureViewRef } from 'react-native-signature-canvas'

export function SignaturePad({ onSave, onSkip }: { onSave: (base64: string) => void; onSkip: () => void }) {
  const ref = useRef<SignatureViewRef>(null)

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Firma del pasajero (opcional)</Text>
      <View style={styles.canvasWrap}>
        <SignatureScreen
          ref={ref}
          onOK={onSave}
          webStyle="body,html{background:#f5f2ec;margin:0;padding:0;} .m-signature-pad--footer{display:none;}"
          backgroundColor="#f5f2ec"
        />
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.secondaryButton} onPress={() => ref.current?.clearSignature()}>
          <Text style={styles.secondaryButtonText}>Borrar</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onSkip}>
          <Text style={styles.secondaryButtonText}>Omitir</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={() => ref.current?.readSignature()}>
          <Text style={styles.primaryButtonText}>Guardar firma</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  label: { color: '#a8a39a', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  canvasWrap: { height: 220, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#3a352e' },
  actions: { flexDirection: 'row', gap: 8 },
  secondaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a352e',
  },
  secondaryButtonText: { color: '#a8a39a', fontSize: 13, fontWeight: '600' },
  primaryButton: { flex: 2, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: '#e9c176' },
  primaryButtonText: { color: '#1d1b18', fontSize: 13, fontWeight: '700' },
})
