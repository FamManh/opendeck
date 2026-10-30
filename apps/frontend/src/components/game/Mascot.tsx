import type { ReactNode } from 'react'

export const SPECIES = ['cat', 'capybara', 'robot', 'dino', 'owl', 'bunny', 'koala', 'fox'] as const
export type Species = (typeof SPECIES)[number]
export const MASCOT_STATES = ['thinking', 'voted', 'sleeping', 'celebrating', 'away'] as const
export type MascotState = (typeof MASCOT_STATES)[number]

export function isSpecies(v: unknown): v is Species {
  return typeof v === 'string' && (SPECIES as readonly string[]).includes(v)
}

// Ported from docs/design/Mascot.dc.html. The mascot palette is intentionally literal.
const BODIES: Record<Species, ReactNode> = {
  cat: (
    <>
      <path d="M30 50 L33 18 L56 36 Z" fill="#FF9F5A" stroke="#FF9F5A" strokeWidth="6" strokeLinejoin="round" />
      <path d="M90 50 L87 18 L64 36 Z" fill="#FF9F5A" stroke="#FF9F5A" strokeWidth="6" strokeLinejoin="round" />
      <path d="M36 41 L37 27 L48 36 Z" fill="#FFC6A0" />
      <path d="M84 41 L83 27 L72 36 Z" fill="#FFC6A0" />
      <circle cx="60" cy="68" r="36" fill="#FF9F5A" />
      <path d="M54 36 V43 M60 34 V44 M66 36 V43" stroke="#E5803C" strokeWidth="3.5" strokeLinecap="round" />
      <ellipse cx="60" cy="82" rx="13" ry="9" fill="#FFE3CC" />
      <path d="M56 76 H64 L60 80 Z" fill="#E0566F" />
      <path d="M28 78 L41 80 M28 86 L41 84 M92 78 L79 80 M92 86 L79 84" stroke="#B4602A" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  capybara: (
    <>
      <circle cx="36" cy="40" r="8" fill="#9C6B45" />
      <circle cx="84" cy="40" r="8" fill="#9C6B45" />
      <rect x="22" y="34" width="76" height="70" rx="32" fill="#C8915F" />
      <ellipse cx="60" cy="86" rx="24" ry="15" fill="#B07A4D" />
      <ellipse cx="53" cy="79" rx="2.6" ry="1.7" fill="#5A3A22" />
      <ellipse cx="67" cy="79" rx="2.6" ry="1.7" fill="#5A3A22" />
    </>
  ),
  robot: (
    <>
      <path d="M60 34 V19" stroke="#3E9C97" strokeWidth="4" strokeLinecap="round" />
      <circle cx="60" cy="15" r="6" fill="#FFB627" />
      <rect x="14" y="58" width="11" height="20" rx="5" fill="#3E9C97" />
      <rect x="95" y="58" width="11" height="20" rx="5" fill="#3E9C97" />
      <rect x="22" y="32" width="76" height="70" rx="22" fill="#5CC8C2" />
      <rect x="31" y="45" width="58" height="47" rx="15" fill="#E3FAF8" />
    </>
  ),
  dino: (
    <>
      <path d="M40 40 L45 22 L54 35 Z M54 34 L60 16 L67 34 Z M67 35 L75 22 L80 40 Z" fill="#4FA544" stroke="#4FA544" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="60" cy="68" r="36" fill="#7BC86C" />
      <ellipse cx="60" cy="86" rx="19" ry="12" fill="#B6E3A8" />
      <circle cx="55" cy="79" r="1.7" fill="#2F6B28" />
      <circle cx="65" cy="79" r="1.7" fill="#2F6B28" />
    </>
  ),
  owl: (
    <>
      <path d="M32 46 L29 24 L48 36 Z M88 46 L91 24 L72 36 Z" fill="#8A6EE8" stroke="#8A6EE8" strokeWidth="5" strokeLinejoin="round" />
      <circle cx="60" cy="68" r="36" fill="#A68BFF" />
      <circle cx="48" cy="61" r="12" fill="#F3EEFF" />
      <circle cx="72" cy="61" r="12" fill="#F3EEFF" />
      <path d="M56 71 H64 L60 78 Z" fill="#FFB627" stroke="#FFB627" strokeWidth="2" strokeLinejoin="round" />
      <path d="M46 95 q4 4 8 0 M56 97 q4 4 8 0 M66 95 q4 4 8 0" stroke="#8A6EE8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </>
  ),
  bunny: (
    <>
      <ellipse cx="45" cy="26" rx="9" ry="24" fill="#FF9DBB" transform="rotate(-8 45 26)" />
      <ellipse cx="75" cy="26" rx="9" ry="24" fill="#FF9DBB" transform="rotate(8 75 26)" />
      <ellipse cx="45" cy="28" rx="4" ry="16" fill="#FFD3E0" transform="rotate(-8 45 28)" />
      <ellipse cx="75" cy="28" rx="4" ry="16" fill="#FFD3E0" transform="rotate(8 75 28)" />
      <circle cx="60" cy="68" r="36" fill="#FF9DBB" />
      <ellipse cx="60" cy="78" rx="3.5" ry="2.5" fill="#E0566F" />
    </>
  ),
  koala: (
    <>
      <circle cx="29" cy="46" r="16" fill="#A9B4C6" />
      <circle cx="91" cy="46" r="16" fill="#A9B4C6" />
      <circle cx="29" cy="46" r="9" fill="#E8ECF3" />
      <circle cx="91" cy="46" r="9" fill="#E8ECF3" />
      <circle cx="60" cy="68" r="36" fill="#A9B4C6" />
      <ellipse cx="60" cy="73" rx="7" ry="8.5" fill="#3A4357" />
    </>
  ),
  fox: (
    <>
      <path d="M28 50 L30 16 L56 36 Z M92 50 L90 16 L64 36 Z" fill="#FF7A3D" stroke="#FF7A3D" strokeWidth="5" strokeLinejoin="round" />
      <path d="M29 30 L30 16 L41 24 Z M91 30 L90 16 L79 24 Z" fill="#3A2A22" stroke="#3A2A22" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="60" cy="68" r="36" fill="#FF7A3D" />
      <path d="M25 70 Q44 68 60 90 Q76 68 95 70 Q91 100 60 104 Q29 100 25 70 Z" fill="#FFF4EA" />
      <ellipse cx="60" cy="80" rx="4.5" ry="3.2" fill="#3A2A22" />
    </>
  ),
}

const FACES: Record<MascotState, ReactNode> = {
  thinking: (
    <>
      <circle cx="49" cy="59" r="5" fill="#1F2A44" />
      <circle cx="73" cy="59" r="5" fill="#1F2A44" />
      <circle cx="50.6" cy="57.3" r="1.6" fill="#fff" />
      <circle cx="74.6" cy="57.3" r="1.6" fill="#fff" />
      <path d="M55 87 Q58 84 61 87 T67 87" stroke="#1F2A44" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <circle cx="92" cy="38" r="3.5" fill="#fff" stroke="#1F2A44" strokeWidth="1.6" />
      <circle cx="99" cy="28" r="5" fill="#fff" stroke="#1F2A44" strokeWidth="1.6" />
      <ellipse cx="102" cy="11" rx="16" ry="11" fill="#fff" stroke="#1F2A44" strokeWidth="1.8" />
      <circle cx="96" cy="11" r="1.9" fill="#1F2A44" />
      <circle cx="102" cy="11" r="1.9" fill="#1F2A44" />
      <circle cx="108" cy="11" r="1.9" fill="#1F2A44" />
    </>
  ),
  voted: (
    <>
      <path d="M43 63 Q48 56 53 63 M67 63 Q72 56 77 63" stroke="#1F2A44" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M54 84 Q60 90 66 84" stroke="#1F2A44" strokeWidth="3" fill="none" strokeLinecap="round" />
      <g transform="rotate(-8 60 104)">
        <rect x="46" y="86" width="28" height="36" rx="5" fill="#2B4170" stroke="#FFF6E0" strokeWidth="2.5" />
        <path d="M60 96 Q60 104 66 104 Q60 104 60 112 Q60 104 54 104 Q60 104 60 96 Z" fill="#FFB627" />
      </g>
      <circle cx="46" cy="101" r="6.5" fill="#FFF1DD" stroke="#D9C6A4" strokeWidth="1.5" />
      <circle cx="75" cy="99" r="6.5" fill="#FFF1DD" stroke="#D9C6A4" strokeWidth="1.5" />
    </>
  ),
  sleeping: (
    <>
      <path d="M42 62 Q48 67 54 62 M66 62 Q72 67 78 62" stroke="#1F2A44" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <circle cx="60" cy="87" r="2.8" fill="#1F2A44" />
      <text x="88" y="36" fontFamily="Hanken Grotesk Variable, sans-serif" fontWeight="800" fontSize="15" fill="#7C8DB5">z</text>
      <text x="98" y="22" fontFamily="Hanken Grotesk Variable, sans-serif" fontWeight="800" fontSize="20" fill="#7C8DB5">Z</text>
    </>
  ),
  celebrating: (
    <>
      <path d="M43 63 Q48 56 53 63 M67 63 Q72 56 77 63" stroke="#1F2A44" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M50 82 Q60 99 70 82 Z" fill="#1F2A44" stroke="#1F2A44" strokeWidth="2" strokeLinejoin="round" />
      <path d="M55 90 Q60 95 65 90 Q60 87 55 90 Z" fill="#FF6B8A" />
      <circle cx="19" cy="46" r="8" fill="#FFF1DD" stroke="#D9C6A4" strokeWidth="1.5" />
      <circle cx="101" cy="46" r="8" fill="#FFF1DD" stroke="#D9C6A4" strokeWidth="1.5" />
      <path d="M12 14 Q12 22 20 22 Q12 22 12 30 Q12 22 4 22 Q12 22 12 14 Z" fill="#FFB627" />
      <path d="M108 12 Q108 18 114 18 Q108 18 108 24 Q108 18 102 18 Q108 18 108 12 Z" fill="#FF7A3D" />
      <circle cx="100" cy="34" r="2.5" fill="#5CC8C2" />
      <circle cx="22" cy="6" r="2.5" fill="#A68BFF" />
    </>
  ),
  away: (
    <>
      <path d="M43 62 H53 M67 62 H77" stroke="#1F2A44" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M55 87 H65" stroke="#1F2A44" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
}

const LAYER = { position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' } as const

function Layer({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 120 120" style={LAYER} aria-hidden="true">{children}</svg>
}

export interface MascotProps {
  species: Species
  state: MascotState
  size?: number | string
  className?: string
}

export function Mascot({ species, state, size, className }: MascotProps) {
  const px = typeof size === 'number' ? `${size}px` : size
  return (
    <div
      data-slot="mascot"
      data-species={species}
      data-state={state}
      className={className}
      style={{ position: 'relative', width: px ?? '100%', height: px ?? '100%' }}
    >
      <Layer>{BODIES[species]}</Layer>
      <Layer>
        <ellipse cx="37" cy="74" rx="5.5" ry="3.5" fill="#FF6B8A" opacity="0.35" />
        <ellipse cx="83" cy="74" rx="5.5" ry="3.5" fill="#FF6B8A" opacity="0.35" />
      </Layer>
      <Layer>{FACES[state]}</Layer>
    </div>
  )
}
