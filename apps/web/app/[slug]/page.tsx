import { redirect } from 'next/navigation'

// Red de seguridad: cualquier enlace corto "dominio/<slug>" (compartido antes de
// esta corrección, o escrito a mano por un cliente) redirige al micrositio real
// en /book/<slug>. La página de destino ya valida que la empresa exista/esté
// activa y devuelve 404 si no — aquí no duplicamos esa consulta.
export default function ShortSlugRedirect({ params }: { params: { slug: string } }) {
  redirect(`/book/${params.slug}`)
}
