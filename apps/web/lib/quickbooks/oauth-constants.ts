// Constantes compartidas entre app/actions/quickbooks.ts (inicia el OAuth) y
// app/api/quickbooks/callback/route.ts (lo recibe) — separadas de
// actions/quickbooks.ts porque un archivo 'use server' solo puede exportar
// funciones async, no constantes.

export const QUICKBOOKS_CALLBACK_PATH = '/api/quickbooks/callback'
export const QUICKBOOKS_OAUTH_STATE_COOKIE = 'qb_oauth_state'
