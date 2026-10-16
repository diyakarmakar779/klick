import { useEffect, useRef, useState } from "react";
import { Boxes, ScanLine } from "lucide-react";
import type { BlockQr as Experience, BlockQrState } from "../lib/blockQr";

// My QR as a building-block city: seen from above, the blocks are the QR code.
// Three.js loads only on this screen. If WebGL is missing, it fails to load, or the code
// doesn't verify, the flat code (`svg`) is shown instead so scanning always works.
export default function BlockQr({ url, svg }: { url: string; svg: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const three = useRef<HTMLCanvasElement>(null);
  const qr = useRef<HTMLCanvasElement>(null);
  const exp = useRef<Experience | null>(null);
  const [state, setState] = useState<BlockQrState | null>(null);
  const [flat, setFlat] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("../lib/blockQr")
      .then(({ canUseWebGL, createBlockQr }) => {
        if (cancelled) return;
        if (!canUseWebGL() || !stage.current || !three.current || !qr.current) return setFlat(true);
        exp.current = createBlockQr({ stage: stage.current, threeCanvas: three.current, qrCanvas: qr.current, onChange: setState });
        setReady(true);
      })
      .catch(() => !cancelled && setFlat(true));
    return () => {
      cancelled = true;
      exp.current?.dispose();
      exp.current = null;
    };
  }, []);

  // Falling back to the flat code: stop the WebGL loop straight away.
  useEffect(() => {
    if (!flat) return;
    exp.current?.dispose();
    exp.current = null;
  }, [flat]);

  // A new code every refresh: rebuild the blocks for it, keeping the current view.
  useEffect(() => {
    if (!ready || flat || !exp.current) return;
    try {
      if (!exp.current.setDestination(url)) setFlat(true);
    } catch {
      setFlat(true);
    }
  }, [url, ready, flat]);

  if (flat) return <div className="k-qr__code" role="img" aria-label="Your Klick QR code" dangerouslySetInnerHTML={{ __html: svg }} />;

  const top = state?.view === "top";
  return (
    <div className="k-blockqr">
      <div
        ref={stage}
        className="k-blockqr__stage"
        data-mode={top ? "scan" : "sculpture"}
        role="button"
        tabIndex={0}
        aria-label={top ? "Your Klick QR code, seen from above. Select to go back to the blocks." : "Your Klick blocks. Drag sideways to turn them, or select to see the QR code from above."}
      >
        <canvas ref={three} className="k-blockqr__three" aria-hidden="true" />
        <canvas ref={qr} className="k-blockqr__verify" aria-hidden="true" />
        {!state && <div className="k-blockqr__loading">Building your blocks…</div>}
        <p className="k-blockqr__caption" aria-live="polite">
          {top ? (state?.viewReady ? "Scan to Klick" : "Turning…") : "Drag to turn. Tap to see the code."}
        </p>
      </div>
      <button type="button" className={`pd-btn ${top ? "pd-btn--outline" : "pd-btn--primary"} pd-btn--lg`} disabled={!state} onClick={() => exp.current?.toggle()}>
        {top ? <Boxes className="pd-i" aria-hidden="true" /> : <ScanLine className="pd-i" aria-hidden="true" />}
        {top ? "Back to the blocks" : "Show code to scan"}
      </button>
    </div>
  );
}
