/** A cartoon arrow pointing right; `buried` hides the head, for an arrow stuck in someone. */
export function Arrow({ buried = false, className = '' }: { buried?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 64 16" aria-hidden className={className}>
      <path d="M4 3 L14 8 L4 13 L9 8 Z" fill="#e5383b" />
      <path d="M10 3 L20 8 L10 13 L15 8 Z" fill="#ff6b6b" />
      <rect x="8" y="6.3" width={buried ? 52 : 44} height="3.4" rx="1.5" fill="#8d5524" />
      {!buried && <path d="M49 2.5 L63 8 L49 13.5 Z" fill="#9aa5b1" stroke="#5c6670" strokeWidth=".8" />}
    </svg>
  )
}
