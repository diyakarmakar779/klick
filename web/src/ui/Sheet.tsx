import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMediaQuery } from "../lib/useMediaQuery";

// ResponsiveDialog: a bottom sheet on phones, a centred dialog from 768px. Escape or the backdrop closes it.
export default function Sheet({ title, description, onClose, children }: { title: string; description?: string; onClose: () => void; children: ReactNode }) {
  const wide = useMediaQuery("(min-width: 768px)");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className={`k-overlay ${wide ? "k-overlay--center" : ""}`} onClick={onClose}>
      <div
        ref={ref}
        className={wide ? "pd-dialog" : "pd-sheet"}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {!wide && <div className="pd-sheet__grab" />}
        <h3>{title}</h3>
        {description && <p>{description}</p>}
        {children}
      </div>
    </div>,
    document.body,
  );
}
