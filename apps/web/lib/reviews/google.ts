// ── Reseñas de Google (Places Details API) ────────────────────────────────────
// Cada operador configura su Google Place ID; traemos sus reseñas reales para
// mostrarlas en el microsite. Cache 1h. Requiere GOOGLE_MAPS_SERVER_KEY con la
// Places API habilitada.

export interface GoogleReview {
  author: string
  rating: number
  text: string
  relativeTime: string
  profilePhoto: string | null
}

export interface GoogleReviewsResult {
  reviews: GoogleReview[]
  rating: number | null
  total: number | null
}

const EMPTY: GoogleReviewsResult = { reviews: [], rating: null, total: null }

export async function fetchGoogleReviews(
  placeId: string | null | undefined,
  language = 'es',
): Promise<GoogleReviewsResult> {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY
  if (!key || !placeId) return EMPTY

  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${encodeURIComponent(placeId)}` +
      `&fields=reviews,rating,user_ratings_total` +
      `&reviews_sort=newest&language=${language}&key=${key}`

    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return EMPTY
    const data = (await res.json()) as {
      result?: {
        rating?: number
        user_ratings_total?: number
        reviews?: Array<{
          author_name: string
          rating: number
          text: string
          relative_time_description: string
          profile_photo_url?: string
        }>
      }
    }
    const result = data.result
    if (!result) return EMPTY

    const reviews: GoogleReview[] = (result.reviews ?? [])
      .filter((r) => r.text && r.rating >= 4)
      .map((r) => ({
        author: r.author_name,
        rating: r.rating,
        text: r.text,
        relativeTime: r.relative_time_description,
        profilePhoto: r.profile_photo_url ?? null,
      }))

    return { reviews, rating: result.rating ?? null, total: result.user_ratings_total ?? null }
  } catch {
    return EMPTY
  }
}
