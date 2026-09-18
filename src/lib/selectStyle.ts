import type { CSSProperties } from 'react'

// Native <select> arrows render inconsistently across browsers (and look
// especially rough at the text-base size mobile inputs now use) -- appearance:
// none removes it, and this draws a teal chevron instead so it matches the
// app's button color rather than the browser's default grey/black one.
const CHEVRON_TEAL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%230d9488' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 8l4 4 4-4'/%3E%3C/svg%3E"

/** Apply alongside the `appearance-none pr-8` classes on any <select>. */
export const selectArrowStyle: CSSProperties = {
  backgroundImage: `url("${CHEVRON_TEAL}")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.65rem center',
  backgroundSize: '1rem',
}
