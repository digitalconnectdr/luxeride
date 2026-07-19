// ── Aviso sonoro corto para alertas en pantalla (nueva reserva) ────────────────
// Generado con Web Audio API (dos tonos) en vez de un archivo de audio, para no
// depender de un asset — no existía ningún patrón de sonido previo en la app web.

export function playAlertChime(): void {
  if (typeof window === 'undefined') return

  try {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    const ctx = new AudioContextClass()
    const now = ctx.currentTime
    const notes = [880, 1174.66] // A5 → D6

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq

      const start = now + i * 0.12
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.4)
    })

    setTimeout(() => ctx.close(), 700)
  } catch {
    // Autoplay bloqueado o navegador sin soporte — el toast visual sigue funcionando
  }
}
