// Compartida entre app/r/[code]/route.ts (setea) y app/actions/auth.ts (lee) —
// en un archivo aparte porque signupAction vive en un módulo 'use server' y
// esos solo pueden exportar funciones async, no constantes.
export const REFERRAL_COOKIE = 'lr_ref'
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 días: ventana landing → signup
