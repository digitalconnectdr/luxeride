// ── Subida de archivos al bucket "documents" ───────────────────────────────────
// Bucket privado ya existente (migración 12 en el repo web), con policy que
// permite a cada usuario subir SOLO bajo su propia carpeta
// (auth.uid()::text = primer segmento del path) — por eso todo se sube bajo
// `${userId}/...`. Devuelve el PATH guardado (no una URL pública, el bucket
// es privado); quien necesite verlo genera un signed URL bajo demanda.

// expo-file-system v19 (SDK 54) movió la API de string-based (readAsStringAsync
// + EncodingType) al subpath /legacy — es el camino de migración oficial.
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { supabase } from './supabase'

async function uploadBase64(path: string, base64: string, contentType: string): Promise<{ path?: string; error?: string }> {
  const { data, error } = await supabase.storage.from('documents').upload(path, decode(base64), {
    contentType,
    upsert: true,
  })
  if (error) return { error: error.message }
  return { path: data.path }
}

export async function uploadDriverDocumentPhoto(
  userId: string,
  kind: 'license' | 'insurance',
  localUri: string,
): Promise<{ path?: string; error?: string }> {
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 })
  return uploadBase64(`${userId}/${kind}.jpg`, base64, 'image/jpeg')
}

export async function uploadPassengerSignature(
  userId: string,
  bookingId: string,
  signatureBase64: string,
): Promise<{ path?: string; error?: string }> {
  // react-native-signature-canvas entrega un data URI (`data:image/png;base64,...`)
  const raw = signatureBase64.includes(',') ? signatureBase64.split(',')[1] : signatureBase64
  return uploadBase64(`${userId}/signatures/${bookingId}.png`, raw, 'image/png')
}

// ── Foto de perfil (bucket "avatars", público) ──────────────────────────────
// Bucket ya existente (migración 12), con policy que permite a cada usuario
// subir/actualizar SOLO su propia carpeta. Al ser público, se devuelve la URL
// pública directamente (el pasajero la ve en /track/[id] sin necesitar sesión).

export async function uploadDriverAvatar(userId: string, localUri: string): Promise<{ url?: string; error?: string }> {
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 })
  const path = `${userId}/avatar.jpg`
  const { error } = await supabase.storage.from('avatars').upload(path, decode(base64), {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (error) return { error: error.message }
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  // Cache-bust: el bucket es público y el path no cambia entre fotos, así que
  // sin esto la imagen vieja quedaría cacheada en el cliente del pasajero.
  return { url: `${data.publicUrl}?t=${Date.now()}` }
}
