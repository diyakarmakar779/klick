import { Box } from "lucide-react";

const PLATE = 279; // px across, like the design
const MAX_PIECES = 360;
const PALETTE = ["#2f9d6f", "#e46a64", "#f2b632", "#3b6fe0"];

// Small deterministic hash so the same member always gets the same city.
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

// Cells nearest the middle fill first, with a little jitter so the edge looks built up, not square.
// The plate is sized to the city, so a few pieces still read as a city rather than a speck.
function layout(seed: string, pieces: number) {
  const n = Math.min(pieces, MAX_PIECES);
  const SIZE = Math.max(7, Math.min(29, Math.ceil(Math.sqrt(n * 2.2)) + 2));
  const CELL = PLATE / (SIZE + 2);
  const mid = (SIZE - 1) / 2;
  const cells = [];
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const jitter = hash(`${seed}:${x}:${y}`);
      const r = hash(`${y}:${x}:${seed}:h`);
      cells.push({ x, y, r, d: Math.hypot(x - mid, y - mid) + jitter * 3 });
    }
  cells.sort((a, b) => a.d - b.d);
  const blocks = cells.slice(0, n).map(({ x, y, r }) => {
    const h = 1 + Math.floor(r * 6);
    const stops = Array.from({ length: h }, (_, i) => `${PALETTE[i % 4]} ${(i * 100) / h}% ${((i + 1) * 100) / h}%`);
    return { x, y, z: Math.round(h * CELL * 0.55), top: PALETTE[(h - 1) % 4], side: `linear-gradient(to top, ${stops.join(", ")})` };
  });
  return { blocks, cell: CELL };
}

// Your Klick city: a decorative block city that gains pieces as you go to events. It isn't a code.
export default function KlickCity({ seed, pieces }: { seed: string; pieces: number }) {
  const { blocks, cell } = layout(seed, pieces);
  return (
    <div className="k-city" aria-hidden="true">
      <div className="k-city__stage" style={{ width: PLATE, height: PLATE, marginLeft: -PLATE / 2, ["--cell" as string]: `${cell}px` }}>
        <div className="k-city__grid" />
        <div className="k-city__plate" />
        {blocks.map((b) => (
          <div key={`${b.x}-${b.y}`} className="k-city__piece" style={{ left: (b.x + 1) * cell, top: (b.y + 1) * cell }}>
            <i style={{ background: b.top, transform: `translateZ(${b.z}px)` }} />
            <i className="k-city__s1" style={{ height: b.z, background: b.side }} />
            <i className="k-city__s2" style={{ width: b.z, background: b.side }} />
          </div>
        ))}
      </div>
      <span className="k-city__label">
        <Box className="pd-i" />
        Your Klick city · grows with every event
      </span>
    </div>
  );
}
