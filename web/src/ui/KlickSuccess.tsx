import type { ReactNode } from "react";

// Two blocks snapping together: the moment two people are connected.
export default function KlickSuccess({ name, detail, children }: { name: string; detail: string; children?: ReactNode }) {
  return (
    <div className="pd-klick" role="status">
      <div className="pd-snap k-snap">
        <span className="pd-block pd-block--1" style={{ "--u": "26px" } as React.CSSProperties} aria-hidden="true">
          <span className="pd-stud" />
        </span>
        <span className="pd-block pd-block--4" style={{ "--u": "26px" } as React.CSSProperties} aria-hidden="true">
          <span className="pd-stud" />
          <span className="pd-stud" />
          <span className="pd-stud" />
          <span className="pd-stud" />
        </span>
      </div>
      <h3>You and {name} Klicked</h3>
      <p>{detail}</p>
      {children && <div className="pd-actions" style={{ justifyContent: "center" }}>{children}</div>}
    </div>
  );
}
