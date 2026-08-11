'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImageLightboxProps {
  images: string[]
  initialIndex: number
  alt: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImageLightbox({ images, initialIndex, alt, open, onOpenChange }: ImageLightboxProps) {
  const [index, setIndex] = useState(initialIndex)

  // Reset to whichever image was clicked each time the lightbox opens.
  useEffect(() => { if (open) setIndex(initialIndex) }, [open, initialIndex])

  const goPrev = useCallback(() => setIndex((i) => (i - 1 + images.length) % images.length), [images.length])
  const goNext = useCallback(() => setIndex((i) => (i + 1) % images.length), [images.length])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onOpenChange, goPrev, goNext])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpenChange(false) }}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      {images.length > 1 && (
        <span className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white tabular-nums">
          {index + 1} / {images.length}
        </span>
      )}

      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goPrev() }}
          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 sm:left-4 sm:p-3"
          aria-label="Previous image"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[index]}
        alt={alt}
        className="max-h-[85vh] max-w-[92vw] select-none object-contain"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goNext() }}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 sm:right-4 sm:p-3"
          aria-label="Next image"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {images.length > 1 && images.length <= 10 && (
        <div
          className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-white/10 p-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setIndex(i)}
              className={cn(
                'h-10 w-10 shrink-0 overflow-hidden rounded-md border-2 transition-colors',
                i === index ? 'border-white' : 'border-transparent opacity-50 hover:opacity-80'
              )}
              aria-label={`Go to image ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  )
}
