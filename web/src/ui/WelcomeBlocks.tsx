import { firstName } from "../lib/people";
import type { ReactNode } from "react";

function greeting(name: string) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return `Good ${part}, ${firstName(name)}`;
}

export default function WelcomeBlocks({
  name,
  className = "",
  subtitle = "Ask anything about your events",
  children,
}: {
  name: string;
  className?: string;
  subtitle?: string | null;
  children?: ReactNode;
}) {
  return (
    <section className={`k-welcome ${className}`.trim()} aria-labelledby="k-welcome-title">
      <div className="k-welcome__intro">
        <h1 id="k-welcome-title">{greeting(name)}</h1>
        {subtitle && <p>{subtitle}</p>}
        {children && <div className="k-welcome__actions">{children}</div>}
      </div>
    </section>
  );
}
