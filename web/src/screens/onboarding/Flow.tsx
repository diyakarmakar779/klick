import { useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Api, type OnboardingStep } from "../../lib/api";
import { useMe } from "../../lib/me";

export const TOTAL = 6;

// One onboarding screen: back arrow, "Step n of 6" with six bars, title, subtitle, body and a footer pinned low.
export default function Flow({
  step,
  onBack,
  title,
  sub,
  children,
  foot,
}: {
  step?: number;
  onBack?: () => void;
  title: string;
  sub?: ReactNode;
  children?: ReactNode;
  foot?: ReactNode;
}) {
  return (
    <div className="k-flow k-onb">
      <div className="pd-page pd-page--narrow">
        <header className="k-onb__bar">
          {onBack ? (
            <button type="button" className="k-onb__back" aria-label="Back" onClick={onBack}>
              <ArrowLeft className="pd-i" aria-hidden="true" />
            </button>
          ) : (
            <span />
          )}
          {step && (
            <span className="k-caption">
              Step {step} of {TOTAL}
            </span>
          )}
        </header>
        {step && (
          <div className="k-onb__bars" role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL} aria-valuenow={step}>
            {Array.from({ length: TOTAL }, (_, i) => (
              <span key={i} className={i < step ? "on" : ""} />
            ))}
          </div>
        )}
        <h1 className="k-onb__title">{title}</h1>
        {sub && <p className="k-onb__sub">{sub}</p>}
        {children}
        {foot && <div className="k-flow__foot">{foot}</div>}
      </div>
    </div>
  );
}

// Moves the member to another onboarding step on the server, so a reload lands on the same screen.
// eslint-disable-next-line react-refresh/only-export-components
export function useGo() {
  const { setMe } = useMe();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function go(step: OnboardingStep, before?: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      if (before) await before();
      setMe(await Api.setStep(step));
    } catch {
      setBusy(false);
      setError("Couldn't save that. Check your connection, then retry.");
    }
  }
  return { go, busy, error, setError };
}

export function FlowError({ children }: { children: string }) {
  return children ? (
    <p className="pd-error" role="alert">
      {children}
    </p>
  ) : null;
}
