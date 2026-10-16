import type { ReactNode } from "react";

// Section heading with an optional count pill and action on the right.
export default function SectionHead({ title, count, action }: { title: string; count?: number; action?: ReactNode }) {
  return (
    <div className="k-shead">
      <h3>
        {title}
        {count !== undefined && <span className="k-count">{count}</span>}
      </h3>
      {action}
    </div>
  );
}
