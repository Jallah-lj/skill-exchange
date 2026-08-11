'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PostImageCarouselProps {
  images: string[]
  alt: string
  onImageClick: (index: number) => void
  /** 'video' for the compact feed-card preview, 'large' for the full post dialog. */
  size?: 'video' | 'large'
}

export function PostImageCarousel({ images, alt, onImageClick, size = 'video' }: PostImageCarouselProps) {
  const [index, setIndex] = useState(0)

  if (images.length === 0) return null

  const goPrev = (e: React.MouseEvent) => { e.stopPropagation(); setIndex((i) => (i - 1 + images.length) % images.length) }
  const goNext = (e: React.MouseEvent) => { e.stopPropagation(); setIndex((i) => (i + 1) % images.length) }

  return (
    <div
      className={cn(
        'group relative w-full overflow-hidden rounded-xl border bg-gray-100 dark:bg-gray-900',
        size === 'video' ? 'aspect-video' : 'aspect-[4/3] sm:aspect-video'
      )}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onImageClick(index) }}
        className="absolute inset-0 h-full w-full cursor-zoom-in"
        aria-label={`View image ${index + 1} of ${images.length}`}
      >
        <Image
          src={images[index]}
          alt={alt}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </button>

      {/* Zoom hint, visible on hover so the click-to-enlarge affordance is discoverable */}
      <div className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100">
        <Maximize2 className="h-3.5 w-3.5" />
      </div>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/60 group-hover:opacity-100"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/60 group-hover:opacity-100"
            aria-label="Next image"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <span className="absolute right-2 bottom-2 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-medium text-white tabular-nums">
            {index + 1} / {images.length}
          </span>

          {images.length <= 8 && (
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
              {images.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setIndex(i) }}
                  className={cn(
                    'h-1.5 w-1.5 rounded-full transition-all',
                    i === index ? 'w-3 bg-white' : 'bg-white/50 hover:bg-white/75'
                  )}
                  aria-label={`Go to image ${i + 1}`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
