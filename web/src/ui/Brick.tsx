import { useRef, useState, type CSSProperties } from "react";
import type { BlockColor, BlockStuds } from "../lib/api";

const GRID: Record<BlockStuds, [number, number]> = { 1: [1, 1], 4: [2, 2], 6: [3, 2], 8: [4, 2] };

// The member's block in 3D, drawn with CSS so it needs no WebGL. Drag sideways to turn it.
export default function Brick({ color, studs, unit = 44, drag = false }: { color: BlockColor; studs: BlockStuds; unit?: number; drag?: boolean }) {
  const [cols, rows] = GRID[studs];
  const [turn, setTurn] = useState(-35);
  const from = useRef<{ x: number; turn: number } | null>(null);
  const w = cols * unit;
  const d = rows * unit;
  const h = unit * 0.9;
  const face = (fw: number, fh: number, transform: string, cls: string) => (
    <div className={`k-brick__face ${cls}`} style={{ width: fw, height: fh, marginLeft: -fw / 2, marginTop: -fh / 2, transform }} />
  );
  return (
    <div
      className={`k-brick k-brick--${color}${drag ? " k-brick--drag" : ""}`}
      style={{ "--u": `${unit}px`, height: (w + d) * 0.62 + h } as CSSProperties}
      aria-hidden="true"
      onPointerDown={
        drag
          ? (e) => {
              from.current = { x: e.clientX, turn };
              e.currentTarget.setPointerCapture(e.pointerId);
            }
          : undefined
      }
      onPointerMove={drag ? (e) => from.current && setTurn(from.current.turn + (e.clientX - from.current.x) * 0.6) : undefined}
      onPointerUp={drag ? () => (from.current = null) : undefined}
      onPointerCancel={drag ? () => (from.current = null) : undefined}
    >
      <div className="k-brick__obj" style={{ transform: `rotateX(-28deg) rotateY(${turn}deg)` }}>
        {face(w, h, `translateZ(${d / 2}px)`, "k-brick__face--front")}
        {face(w, h, `rotateY(180deg) translateZ(${d / 2}px)`, "k-brick__face--front")}
        {face(d, h, `rotateY(90deg) translateZ(${w / 2}px)`, "k-brick__face--side")}
        {face(d, h, `rotateY(-90deg) translateZ(${w / 2}px)`, "k-brick__face--side")}
        <div
          className="k-brick__face k-brick__face--top"
          style={{ width: w, height: d, marginLeft: -w / 2, marginTop: -d / 2, transform: `rotateX(90deg) translateZ(${h / 2}px)`, gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {Array.from({ length: cols * rows }, (_, i) => (
            <span key={i} className="k-brick__stud">
              <i />
              <i />
              <i />
              <i />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Flat side-on brick for the welcome screen and the logo.
export function FlatBrick({ color, width, studs = 2 }: { color: BlockColor; width: number; studs?: number }) {
  return (
    <span className={`k-fbrick k-brick--${color}`} style={{ width, "--studs": studs } as CSSProperties} aria-hidden="true">
      {Array.from({ length: studs }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}
