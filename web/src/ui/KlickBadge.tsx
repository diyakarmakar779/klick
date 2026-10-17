import type { ReactNode } from "react";
import type { BlockColor } from "../lib/api";

// The member's Klick badge: a lanyard card in their block colour with their name, and details underneath.
export default function KlickBadge({ color, name, label, photo, children }: { color: BlockColor; name: string; label?: string; photo?: string | null; children?: ReactNode }) {
  const [first, ...rest] = name.trim().split(/\s+/);
  return (
    <div className={`k-badge k-brick--${color}`}>
      <div className="k-badge__top" aria-hidden="true" />
      <div className="k-badge__band">
        <div>
          <h2>
            {first}
            {rest.length > 0 && <span>{rest.join(" ")}</span>}
          </h2>
          {label && <p className="k-badge__label">{label}</p>}
        </div>
        {photo ? <img src={photo} alt="" referrerPolicy="no-referrer" /> : null}
      </div>
      {children && <div className="k-badge__meta">{children}</div>}
    </div>
  );
}
