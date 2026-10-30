import { Mascot, type MascotState, type Species } from '@/components/game/Mascot'
import { PokerCard } from '@/components/game/PokerCard'

interface Seat { species: Species; state: MascotState; x: number; y: number; size: number }
const SEATS: Seat[] = [
  { species: 'cat', state: 'thinking', x: 100, y: 24, size: 88 },
  { species: 'robot', state: 'voted', x: 412, y: 24, size: 88 },
  { species: 'capybara', state: 'voted', x: 0, y: 206, size: 84 },
  { species: 'dino', state: 'celebrating', x: 516, y: 206, size: 84 },
  { species: 'owl', state: 'voted', x: 160, y: 384, size: 84 },
  { species: 'bunny', state: 'sleeping', x: 356, y: 384, size: 84 },
]

/** Decorative table from the design (600x480 canvas), scaled to fit. */
export function TableIllustration({ scale = 1, celebrate = false }: { scale?: number; celebrate?: boolean }) {
  return (
    <div style={{ width: 600 * scale, height: 480 * scale }} aria-hidden="true" className="relative">
      <div className="absolute top-0 left-0 h-[480px] w-[600px] origin-top-left" style={{ transform: `scale(${scale})` }}>
        <div className="absolute top-[110px] left-[50px] h-[270px] w-[500px] rounded-full bg-border p-[9px]">
          <div className="relative size-full rounded-full bg-felt">
            <div className="absolute inset-4 rounded-full border border-white/15" />
          </div>
        </div>
        <div className="absolute top-[200px] left-[130px] h-14 w-10 -rotate-[8deg]"><PokerCard value="5" faceUp={false} compact instant /></div>
        <div className="absolute top-[200px] left-[430px] h-14 w-10 rotate-[8deg]"><PokerCard value="5" faceUp={false} compact instant /></div>
        <div className="absolute top-[176px] left-[206px] h-[114px] w-20 -rotate-[10deg]"><PokerCard value="3" instant /></div>
        <div className="absolute top-[176px] left-[314px] h-[114px] w-20 rotate-[10deg]"><PokerCard value="8" instant /></div>
        <div className="absolute top-[164px] left-[260px] h-[114px] w-20"><PokerCard value="5" selected instant /></div>
        {SEATS.map(s => (
          <div key={s.species} className="absolute" style={{ left: s.x, top: s.y, width: s.size, height: s.size }}>
            <Mascot species={s.species} state={celebrate ? 'celebrating' : s.state} />
          </div>
        ))}
      </div>
    </div>
  )
}
