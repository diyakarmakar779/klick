import type { ReactNode } from "react";
import Block from "../ui/Block";

// Sticky page header. The block mark shows on phones only; the sidebar carries it from tablet up.
export default function Header({ title, action, back }: { title: string; action?: ReactNode; back?: ReactNode }) {
  return (
    <header className="k-header">
      <div className="pd-page k-header__row">
        {back ?? (
          <span className="k-mark">
            <Block unit={9} />
          </span>
        )}
        <h1 className="k-grow">{title}</h1>
        {action}
      </div>
    </header>
  );
}
