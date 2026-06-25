'use client'

import { useEffect } from 'react'

// Tras calificar, vuelve al micrositio del operador después de N segundos.
export function AutoRedirect({ url, seconds }: { url: string; seconds: number }) {
  useEffect(() => {
    const id = setTimeout(() => {
      window.location.href = url
    }, seconds * 1000)
    return () => clearTimeout(id)
  }, [url, seconds])
  return null
}
