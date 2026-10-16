import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, Lock, XCircle } from "lucide-react";

type Tone = "info" | "privacy" | "warning" | "destructive" | "success";
const ICON = { info: Info, privacy: Lock, warning: AlertTriangle, destructive: XCircle, success: CheckCircle2 };

// Inline banner: title says what happened, body says what to do next, at most one action.
export default function Alert({ tone = "info", title, children, action }: { tone?: Tone; title: string; children?: ReactNode; action?: ReactNode }) {
  const Icon = ICON[tone];
  return (
    <div className={`pd-alert pd-alert--${tone}`} role={tone === "destructive" ? "alert" : undefined}>
      <Icon className="pd-i" aria-hidden="true" />
      <div className="k-grow">
        <b>{title}</b>
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  );
}
