import { useState } from 'react'
import { useLanguage } from '../context/LanguageContext'

interface ImageCarouselProps {
  images: string[]
  alt: string
  /** Slides at this index or later are stock photos, not the real dish -- shown with a small badge. */
  stockFrom?: number
}

export function ImageCarousel({ images, alt, stockFrom }: ImageCarouselProps) {
  const { t } = useLanguage()
  const [index, setIndex] = useState(0)

  if (images.length === 0) return null

  const showPrevNext = images.length > 1
  const isStock = stockFrom !== undefined && index >= stockFrom

  function prev() {
    setIndex((i) => (i - 1 + images.length) % images.length)
  }
  function next() {
    setIndex((i) => (i + 1) % images.length)
  }

  return (
    <div className="w-full max-w-lg">
      <div className="relative overflow-hidden rounded-lg bg-neutral-100">
        <img src={images[index]} alt={alt} className="aspect-4/3 w-full object-cover" />
        {isStock && (
          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
            {t('recipe.stockPhoto')} · Wikimedia Commons
          </span>
        )}
        {showPrevNext && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 px-2 py-1 text-sm font-medium text-neutral-800 hover:bg-white"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next image"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 px-2 py-1 text-sm font-medium text-neutral-800 hover:bg-white"
            >
              ›
            </button>
          </>
        )}
      </div>
      {showPrevNext && (
        <div className="mt-2 flex justify-center gap-1.5">
          {images.map((img, i) => (
            <button
              key={img}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Go to image ${i + 1}`}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${i === index ? 'bg-teal-600' : 'bg-neutral-300'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
