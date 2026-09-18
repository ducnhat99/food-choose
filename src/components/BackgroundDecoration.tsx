interface DecorationItem {
  emoji: string
  top?: string
  left?: string
  right?: string
  bottom?: string
  size: string
  rotate: string
}

const ITEMS: DecorationItem[] = [
  { emoji: '🍃', top: '6%', left: '6%', size: '4rem', rotate: '-15deg' },
  { emoji: '🥕', top: '14%', right: '8%', size: '3.5rem', rotate: '20deg' },
  { emoji: '🍅', bottom: '22%', left: '5%', size: '3rem', rotate: '10deg' },
  { emoji: '🥬', top: '46%', right: '6%', size: '4rem', rotate: '-10deg' },
  { emoji: '🌿', bottom: '10%', right: '18%', size: '3.5rem', rotate: '15deg' },
  { emoji: '🥦', top: '72%', left: '10%', size: '3rem', rotate: '-20deg' },
  { emoji: '🍋', top: '28%', left: '46%', size: '2.5rem', rotate: '5deg' },
  { emoji: '🌶️', bottom: '38%', right: '38%', size: '3rem', rotate: '-8deg' },
  { emoji: '🧄', top: '85%', right: '42%', size: '2.5rem', rotate: '12deg' },
  { emoji: '🍆', bottom: '4%', left: '38%', size: '3rem', rotate: '-12deg' },
  { emoji: '🥑', top: '2%', left: '32%', size: '3rem', rotate: '18deg' },
  { emoji: '🍇', top: '38%', left: '2%', size: '3rem', rotate: '-6deg' },
  { emoji: '🌽', bottom: '30%', right: '4%', size: '3.5rem', rotate: '8deg' },
  { emoji: '🍄', top: '60%', right: '28%', size: '2.5rem', rotate: '-15deg' },
  { emoji: '🍊', bottom: '55%', left: '20%', size: '2.5rem', rotate: '10deg' },
  { emoji: '🥒', top: '80%', left: '30%', size: '3rem', rotate: '-18deg' },
  { emoji: '🍓', top: '4%', right: '30%', size: '2.5rem', rotate: '-10deg' },
  { emoji: '🧅', bottom: '2%', right: '55%', size: '3rem', rotate: '14deg' },
  { emoji: '🥭', top: '55%', left: '38%', size: '2.5rem', rotate: '6deg' },
  { emoji: '🫑', bottom: '48%', right: '48%', size: '2.5rem', rotate: '-10deg' },
]

/**
 * Purely decorative, low-opacity food/plant emoji scattered around the
 * page -- fixed to the viewport so they stay put while scrolling, sit
 * behind all real content, and never intercept clicks.
 */
export function BackgroundDecoration() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {ITEMS.map((item, i) => (
        <span
          key={i}
          className="absolute select-none opacity-10"
          style={{
            top: item.top,
            left: item.left,
            right: item.right,
            bottom: item.bottom,
            fontSize: item.size,
            transform: `rotate(${item.rotate})`,
          }}
        >
          {item.emoji}
        </span>
      ))}
    </div>
  )
}
