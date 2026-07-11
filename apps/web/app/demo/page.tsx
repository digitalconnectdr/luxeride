import type { Metadata } from 'next'
import Image from 'next/image'
import { brand } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Demo microsite | ${brand.name}`,
  robots: { index: false, follow: false },
}

// Demo aislado del rediseño premium del microsite del operador.
// Empresa ficticia "Noir Chauffeurs". Fotos vía next/image (optimizadas).
const BRAND = '#c9a24b'
const u = (slug: string) => `https://unsplash.com/photos/${slug}/download?force=true&w=1600`
const SEDAN = u('NjQmytqwDGs')
const ESCALADE = u('9XVJ-Jq7Ke8')
const SUV = u('4Dofvf-eUMs')
const SPRINTER = u('7I8qdKTHDp4')
const LIMO = u('FZ5MkHkeyKM')

const services = [
  { title: 'Traslados al aeropuerto', desc: 'Recogidas y entregas puntuales con seguimiento de vuelos en tiempo real. Tu chofer te espera, aunque tu vuelo cambie.', img: SPRINTER },
  { title: 'Chofer ejecutivo', desc: 'Choferes profesionales y discretos por horas o día completo. Ideal para ejecutivos, VIPs y delegaciones corporativas.', img: SEDAN },
]
const features = [
  { icon: '◆', title: 'Flota premium', desc: 'Vehículos de alta gama, impecables y mantenidos al detalle.' },
  { icon: '✦', title: 'Choferes profesionales', desc: 'Discretos, multilingües y dedicados a tu comodidad y seguridad.' },
  { icon: '✈', title: 'Vuelos monitoreados', desc: 'Seguimos tu vuelo en vivo para ajustar la recogida sin estrés.' },
  { icon: '★', title: 'Experiencia impecable', desc: 'De la reserva a la llegada, todo fluye con elegancia.' },
]
const fleet = [
  { name: 'Sedán ejecutivo', pax: '3 pasajeros', amen: 'WiFi · Agua · Cargador', img: SEDAN },
  { name: 'SUV de lujo', pax: '6 pasajeros', amen: 'WiFi · Asientos de cuero', img: ESCALADE },
  { name: 'Sprinter VIP', pax: '12 pasajeros', amen: 'Club seats · Minibar', img: SPRINTER },
]
const steps = [
  { n: '01', title: 'Reserva', desc: 'Completa tu viaje en línea o por WhatsApp en menos de un minuto.', img: SUV },
  { n: '02', title: 'Confirmación', desc: 'Recibes la confirmación con los datos de tu chofer y vehículo.', img: ESCALADE },
  { n: '03', title: 'Disfruta', desc: 'Tu chofer llega puntual. Relájate y disfruta el trayecto.', img: LIMO },
]

function BgImage({ src, overlay }: { src: string; overlay: string }) {
  return (
    <>
      <Image src={src} alt="" fill priority sizes="100vw" className="object-cover -z-10" />
      <div className="absolute inset-0 -z-10" style={{ background: overlay }} />
    </>
  )
}

export default function MicrositeDemo() {
  return (
    <div className="bg-[#0b0b0c] text-white antialiased" style={{ ['--brand' as string]: BRAND }}>
      {/* Header */}
      <header className="absolute top-0 inset-x-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/30 font-playfair text-lg" style={{ color: BRAND }}>N</span>
            <div className="leading-tight">
              <p className="font-playfair text-lg tracking-[0.2em] font-semibold">NOIR</p>
              <p className="text-[8px] uppercase tracking-[0.3em] text-white/50">Chauffeurs</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-[13px] text-white/70">
            <a href="#servicios" className="hover:text-white transition-colors">Servicios</a>
            <a href="#flota" className="hover:text-white transition-colors">Flota</a>
            <a href="#pasos" className="hover:text-white transition-colors">Cómo reservar</a>
            <a href="#reservar" className="px-5 py-2 rounded-full text-[#0b0b0c] font-semibold text-xs" style={{ backgroundColor: BRAND }}>Reservar</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative isolate min-h-[88vh] flex items-center overflow-hidden">
        <BgImage src={ESCALADE} overlay="linear-gradient(90deg, rgba(11,11,12,0.94) 0%, rgba(11,11,12,0.55) 55%, rgba(11,11,12,0.2) 100%)" />
        <div className="max-w-6xl mx-auto px-6 w-full">
          <div className="max-w-xl">
            <p className="text-sm uppercase tracking-[0.35em] mb-5" style={{ color: BRAND }}>Transporte de lujo</p>
            <h1 className="font-playfair text-5xl sm:text-6xl font-semibold leading-[1.05] italic">Tu viaje, nuestra prioridad.</h1>
            <p className="mt-6 text-lg text-white/70 leading-relaxed">Traslados al aeropuerto, chofer ejecutivo y experiencias premium con la flota más refinada de la ciudad.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#reservar" className="px-7 py-3.5 rounded-full text-[#0b0b0c] text-sm font-semibold transition-transform hover:scale-[1.03]" style={{ backgroundColor: BRAND }}>Reservar ahora →</a>
              <a href="#" className="px-7 py-3.5 rounded-full text-sm font-semibold border border-white/30 hover:bg-white/10 transition-colors inline-flex items-center gap-2"><span className="text-green-400">●</span> WhatsApp</a>
            </div>
          </div>
        </div>
      </section>

      {/* Servicios alternados */}
      <section id="servicios" className="py-24 bg-[#0e0e10]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-playfair text-4xl font-semibold italic">Nuestros servicios</h2>
            <div className="mx-auto mt-4 h-px w-20" style={{ backgroundColor: BRAND }} />
          </div>
          <div className="space-y-16">
            {services.map((s, i) => (
              <div key={s.title} className="grid lg:grid-cols-2 gap-10 items-center">
                <div className={`relative h-72 rounded-2xl overflow-hidden ${i % 2 === 1 ? 'lg:order-2' : ''}`}>
                  <Image src={s.img} alt={s.title} fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
                </div>
                <div>
                  <h3 className="font-playfair text-3xl font-semibold italic mb-4">{s.title}</h3>
                  <p className="text-white/60 leading-relaxed text-[15px]">{s.desc}</p>
                  <a href="#reservar" className="inline-block mt-6 text-sm font-semibold" style={{ color: BRAND }}>Reservar este servicio →</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* La diferencia */}
      <section className="relative isolate py-24 overflow-hidden">
        <BgImage src={LIMO} overlay="rgba(11,11,12,0.9)" />
        <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-14 items-center">
          <div className="relative h-80 rounded-2xl overflow-hidden border border-white/10">
            <Image src={SEDAN} alt="flota" fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
          </div>
          <div>
            <h2 className="font-playfair text-4xl font-semibold italic mb-10">La diferencia Noir</h2>
            <div className="space-y-7">
              {features.map((f) => (
                <div key={f.title} className="flex gap-4">
                  <span className="h-10 w-10 shrink-0 rounded-full border flex items-center justify-center text-lg" style={{ borderColor: BRAND, color: BRAND }}>{f.icon}</span>
                  <div>
                    <h3 className="font-playfair text-lg font-semibold">{f.title}</h3>
                    <p className="text-sm text-white/55 mt-1 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Flota */}
      <section id="flota" className="py-24 bg-[#0e0e10]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-playfair text-4xl font-semibold italic">Nuestra flota</h2>
            <div className="mx-auto mt-4 h-px w-20" style={{ backgroundColor: BRAND }} />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {fleet.map((v) => (
              <div key={v.name} className="rounded-2xl overflow-hidden border border-white/10 bg-white/[0.02]">
                <div className="relative h-52">
                  <Image src={v.img} alt={v.name} fill sizes="(max-width:1024px) 50vw, 33vw" className="object-cover" />
                </div>
                <div className="p-6">
                  <h3 className="font-playfair text-xl font-semibold">{v.name}</h3>
                  <p className="text-sm text-white/50 mt-1">{v.pax}</p>
                  <p className="text-xs text-white/35 mt-3">{v.amen}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo reservar */}
      <section id="pasos" className="py-24 bg-[#0b0b0c]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-playfair text-4xl font-semibold italic">Reserva en 3 pasos</h2>
            <div className="mx-auto mt-4 h-px w-20" style={{ backgroundColor: BRAND }} />
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {steps.map((st) => (
              <div key={st.n} className="relative isolate rounded-2xl overflow-hidden h-80 flex items-end">
                <BgImage src={st.img} overlay="linear-gradient(rgba(11,11,12,0.15), rgba(11,11,12,0.92))" />
                <div className="p-6">
                  <p className="font-playfair text-3xl font-semibold" style={{ color: BRAND }}>{st.n}</p>
                  <h3 className="font-playfair text-xl font-semibold mt-2">{st.title}</h3>
                  <p className="text-sm text-white/60 mt-2 leading-relaxed">{st.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reservar placeholder */}
      <section id="reservar" className="py-24 bg-[#0e0e10] border-t border-white/5">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="font-playfair text-4xl font-semibold italic mb-4">Reserva tu viaje</h2>
          <p className="text-white/50 mb-8">Aquí va embebido el formulario de reservación de {brand.name} (cotización al instante).</p>
          <div className="rounded-2xl border border-dashed border-white/20 bg-white/[0.02] py-16 text-white/30 text-sm">[ Formulario de reservación {brand.name} ]</div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#080809] border-t border-white/5 py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/30 font-playfair" style={{ color: BRAND }}>N</span>
            <span className="font-playfair tracking-[0.2em] font-semibold">NOIR CHAUFFEURS</span>
          </div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/30">Powered by {brand.name}</p>
        </div>
      </footer>
    </div>
  )
}
