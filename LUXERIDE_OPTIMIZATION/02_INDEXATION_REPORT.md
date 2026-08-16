# Fase 1 - Indexation Report

> Estado: **CERRADA** (1.1–1.4 completas). Auditoría contra el código real
> tras los fixes de esta fase, 2026-08-16.

## Inventario de rutas públicas relevantes

| Ruta | Clasificación | Mecanismo | Nota |
|---|---|---|---|
| `/` | INDEX | default del layout raíz | Home |
| `/en`, `/es`, `/pt` | INDEX | default | Landing por idioma, hreflang |
| `/privacy`, `/terms` | INDEX | default | |
| `/book/{slug}` | **CONDITIONAL** | SEO Publication Gate (nuevo) | `index,follow` solo si: `status='active'` + logo + descripción + contacto + flota activa. Si no, `noindex,follow` |
| `/book/{slug}/partners/{partnerSlug}` | NOINDEX | metadata explícita (ya existía) | `index:false, follow:true` |
| `/{slug}` (link corto) | N/A | `redirect()` a `/book/{slug}` | No es una página indexable por separado |
| `/demo` | NOINDEX | metadata explícita (ya existía) | Micrositio ficticio "Noir Chauffeurs" |
| `/embed/{slug}` | NOINDEX | metadata explícita (ya existía) | Pensado para iframe, no para visita directa |
| `/auth/login`, `/signup`, `/reset-password`, `/update-password`, `/verify-email` | NOINDEX | **agregado esta fase** | Antes heredaban `index:true` del layout raíz (gap real, no solo de título) |
| `/track/{id}` | **PRIVATE** (capability-URL) | **agregado esta fase** | Ubicación en vivo del viaje - antes solo dependía de `robots.txt` |
| `/quote/{id}` | PRIVATE (capability-URL) | metadata explícita (ya existía) | Auditoría inicial se equivocó al listarlo como gap |
| `/review/{id}` | PRIVATE (capability-URL) | metadata explícita (ya existía) | Ídem |
| `/affiliate/join/{token}` | PRIVATE (capability-URL) | **agregado esta fase** | Exponía nombre de empresa sin `robots` |
| `/corporate/join/{token}` | PRIVATE (capability-URL) | **agregado esta fase** | Exponía nombre de cuenta sin `robots` |
| `/r/{code}` | N/A | `route.ts`, solo redirect | No renderiza HTML, no aplica indexación |
| `/admin/*`, `/super-admin/*`, `/dispatcher/*`, `/driver/*`, `/corporate/*` (portal), `/account/*`, `/api/*`, `/payment/*` | PRIVATE | `robots.ts` disallow + auth guard | Ya cubierto, sin cambios |

## robots.ts

Sin cambios - el `disallow` ya cubre correctamente todo lo autenticado. La
lección de esta fase: `robots.txt` disallow **no sustituye** meta `noindex`
para páginas con capability-URL (token en la URL, sin sesión) - si Google
encuentra el link por otro lado, puede indexar la URL desnuda igual. Por eso
el trabajo real de 1.2/1.3 fue meta `robots` página por página, no tocar
`robots.ts`.

## sitemap.ts

Sin cambios de código - pero ahora su criterio de inclusión (empresa activa +
flota) es consistente con el nuevo SEO Publication Gate de `book/[slug]`
(que además exige logo/descripción/contacto). Nunca van a discrepar.

## Resumen de fixes de esta fase (1.1–1.4)

1. Empresa fantasma `luxeride` desactivada + gate por `status` en `book/[slug]`.
2. SEO Publication Gate completo (logo + descripción + contacto + flota).
3. `noindex` en `/affiliate/join/[token]`, `/corporate/join/[token]`, `/track/[id]`.
4. `noindex` + título propio en las 5 páginas de `/auth/*` (gap más serio de
   lo que decía la auditoría original: no era solo el título, esas páginas
   eran indexables por default).

Todo verificado con tsc + build + vitest (303/303) antes de cada deploy.
