import type { ButtonHTMLAttributes } from "react";

type Variant = "brand" | "strong" | "primary" | "secondary" | "outline" | "ghost" | "destructive" | "link";
type Size = "sm" | "lg" | "icon";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

// Prod :D button. `brand` is the one signature action per screen.
export default function Button({ variant = "primary", size, loading, className = "", children, disabled, ...rest }: Props) {
  const cls = ["pd-btn", `pd-btn--${variant}`, size && `pd-btn--${size}`, className].filter(Boolean).join(" ");
  return (
    <button className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {children}
    </button>
  );
}
