import { useState } from "react";
import { Eye, RotateCw } from "lucide-react";
import { Api, type BlockColor, type BlockStuds, type Me } from "../../lib/api";
import Brick from "../../ui/Brick";
import Button from "../../ui/Button";
import Flow, { FlowError, useGo } from "./Flow";

const COLORS: BlockColor[] = ["red", "yellow", "green", "blue"];
const STUDS: BlockStuds[] = [1, 4, 6, 8];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// Step 3: pick a colour and stud pattern. Style only: never rank, trust, seniority or value.
export default function MakeBlock({ me }: { me: Me }) {
  const { go, busy, error } = useGo();
  const [color, setColor] = useState<BlockColor>(me.block?.color ?? "blue");
  const [studs, setStuds] = useState<BlockStuds>(me.block?.studs ?? 4);
  const label = `${cap(color)} · ${studs} stud${studs === 1 ? "" : "s"}`;
  return (
    <Flow
      step={3}
      onBack={() => go("consent")}
      title="Make your block"
      sub="This block is your identity on Klick. It travels with you wherever people find you."
      foot={
        <>
          <FlowError>{error}</FlowError>
          <Button variant="primary" size="lg" loading={busy} onClick={() => go("identity", () => Api.saveMe({ block: { color, studs } }))}>
            Continue with this block
          </Button>
        </>
      }
    >
      <div className="k-mkblock">
        <Brick color={color} studs={studs} unit={studs === 8 ? 34 : studs === 6 ? 40 : 46} drag />
        <span className="k-caption">
          <RotateCw className="pd-i" aria-hidden="true" style={{ width: 14, height: 14 }} />
          Drag to rotate
        </span>
        <b aria-live="polite">{label}</b>
      </div>

      <h2 className="k-onb__h">Signal colour</h2>
      <div className="k-pick" role="group" aria-label="Signal colour">
        {COLORS.map((c) => (
          <button key={c} type="button" aria-pressed={color === c} onClick={() => setColor(c)}>
            <span className={`k-swatch k-brick--${c}`} />
            {cap(c)}
          </button>
        ))}
      </div>

      <h2 className="k-onb__h">Stud pattern</h2>
      <div className="k-pick" role="group" aria-label="Stud pattern">
        {STUDS.map((n) => (
          <button key={n} type="button" aria-pressed={studs === n} onClick={() => setStuds(n)}>
            <span className="k-studs" style={{ gridTemplateColumns: `repeat(${n === 1 ? 1 : n / 2}, auto)` }}>
              {Array.from({ length: n }, (_, i) => (
                <i key={i} />
              ))}
            </span>
            {n} stud{n === 1 ? "" : "s"}
          </button>
        ))}
      </div>

      <p className="k-note k-note--privacy" style={{ marginTop: "var(--space-5)" }}>
        <Eye className="pd-i" aria-hidden="true" />
        <span>Colour and studs are just how you want to look. They never show rank, trust, seniority or value.</span>
      </p>
    </Flow>
  );
}
