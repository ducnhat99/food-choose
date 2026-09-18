import { useEffect } from 'react'

/**
 * Prevents the page behind a fixed full-screen overlay from scrolling while
 * `active` is true. Without this, scrolling/rubber-band-overscrolling the
 * page underneath a `position: fixed; inset: 0` overlay can, on mobile
 * Safari, temporarily reveal the page background past the overlay's edge
 * during the elastic bounce -- making the overlay look like it doesn't
 * reach the bottom of the screen even though it's correctly anchored to the
 * viewport.
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [active])
}
