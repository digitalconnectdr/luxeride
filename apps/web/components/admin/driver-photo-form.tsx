'use client'
// ── Foto del conductor (panel del operador) ────────────────────────────────
// `drivers.photo_url` existía desde antes y el conductor podía llenarla desde
// su propia app, pero el operador no tenía forma de hacerlo — y normalmente es
// él quien tiene la foto corporativa. La foto se ve en el seguimiento del
// pasajero (web y app), así que sin ella el pasajero no sabe a quién esperar.
//
// El avatar es el propio disparador: se hace clic sobre él y se abre el
// selector de archivo. Un botón aparte al lado duplicaría el objetivo de clic
// sin agregar claridad.

import { useActionState, useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, Trash2, Loader2 } from 'lucide-react'
import { updateDriverPhoto } from '@/app/actions/fleet'

interface Props {
  driverId: string
  photoUrl: string | null
  initials: string
  labels: {
    change: string
    remove: string
    hint: string
  }
}

export function DriverPhotoForm({ driverId, photoUrl, initials, labels }: Props) {
  const action = updateDriverPhoto.bind(null, driverId)
  const [state, formAction, pending] = useActionState(action, null)
  const formRef = useRef<HTMLFormElement>(null)
  const removeRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  // Envío al elegir archivo: pedirle además "ahora dale a Guardar" sería un
  // paso de más para una acción de un solo campo.
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    if (removeRef.current) removeRef.current.value = 'false'
    formRef.current?.requestSubmit()
  }

  function onRemove() {
    setPreview(null)
    if (removeRef.current) removeRef.current.value = 'true'
    formRef.current?.requestSubmit()
  }

  const shown = preview ?? photoUrl

  return (
    <form ref={formRef} action={formAction} className="flex items-center gap-3">
      <input ref={removeRef} type="hidden" name="remove" value="false" />

      <label
        className="relative w-12 h-12 rounded-full overflow-hidden shrink-0 cursor-pointer group"
        title={labels.change}
      >
        {shown ? (
          <Image src={shown} alt="" fill sizes="48px" className="object-cover" unoptimized />
        ) : (
          <span className="w-full h-full bg-gold/10 flex items-center justify-center text-lg font-semibold text-bronze">
            {initials}
          </span>
        )}
        {/* Capa de hover: deja claro que el avatar es accionable. */}
        <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {pending ? (
            <Loader2 size={16} className="text-white animate-spin" />
          ) : (
            <Camera size={16} className="text-white" />
          )}
        </span>
        <input
          type="file"
          name="photo"
          accept="image/png,image/jpeg,image/webp"
          onChange={onFileChange}
          disabled={pending}
          className="sr-only"
        />
      </label>

      <div className="min-w-0">
        {photoUrl && !pending && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 text-xs text-sl-on-surface-muted hover:text-red-500 transition-colors"
          >
            <Trash2 size={12} />
            {labels.remove}
          </button>
        )}
        {!photoUrl && !pending && <p className="text-xs text-sl-on-surface-muted">{labels.hint}</p>}
        {state?.error && <p className="text-xs text-red-500 mt-0.5">{state.error}</p>}
      </div>
    </form>
  )
}
