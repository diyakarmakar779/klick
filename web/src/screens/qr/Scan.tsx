import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import jsQR from "jsqr";
import { ClipboardPaste, Flashlight, Keyboard, QrCode, X } from "lucide-react";
import Button from "../../ui/Button";
import Sheet from "../../ui/Sheet";

interface Detector {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
  }
}

// Only Klick codes are followed: a /k/<token> link, or the bare token.
function klickToken(text: string): string | null {
  const t = text.trim();
  const link = t.match(/\/k\/([A-Za-z0-9_-]{10,})/);
  if (link) return link[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(t) ? t : null;
}

// Paste a link instead: for when the camera is blocked, missing, or the code won't read.
function PasteSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState("");

  function open(e: FormEvent) {
    e.preventDefault();
    const token = klickToken(pasted);
    if (!token) return setError("That isn't a Klick link. It ends in /k/ followed by letters and numbers.");
    navigate(`/k/${token}`);
  }

  async function fromClipboard() {
    try {
      setPasted(await navigator.clipboard.readText());
      setError("");
    } catch {
      setError("Klick can't read your clipboard. Long-press the box and choose Paste.");
    }
  }

  return (
    <Sheet title="Paste a link instead" description="Ask them to copy their Klick link from their profile and send it to you." onClose={onClose}>
      <form className="pd-stack" onSubmit={open}>
        <div className="k-paste__row">
          <input
            className="pd-input"
            value={pasted}
            placeholder="https://…/k/…"
            autoComplete="off"
            aria-label="Klick link"
            autoFocus
            onChange={(e) => {
              setPasted(e.target.value);
              setError("");
            }}
          />
          {"clipboard" in navigator && "readText" in navigator.clipboard && (
            <Button type="button" variant="outline" size="icon" aria-label="Paste from clipboard" onClick={fromClipboard}>
              <ClipboardPaste className="pd-i" aria-hidden="true" />
            </Button>
          )}
        </div>
        {error && <p className="k-error">{error}</p>}
        <Button type="submit" variant="brand" disabled={!pasted.trim()}>
          Open
        </Button>
      </form>
    </Sheet>
  );
}

// Scanner (Sivasurya's "Scan a Klick QR"): the nav QR button opens straight here, full screen.
// Codes are read with the browser's BarcodeDetector where it exists and jsQR everywhere else
// (iPhone Safari). Paste a link instead always works, camera or not.
export default function Scan() {
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<MediaStreamTrack | null>(null);
  const navigate = useNavigate();
  const [cameraError, setCameraError] = useState("");
  const [live, setLive] = useState(false);
  const [torch, setTorch] = useState<boolean | null>(null); // null: this camera has no torch
  const [pasting, setPasting] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser can't open the camera. Paste their link instead.");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const v = video.current;
        if (!v || stop) return;
        v.srcObject = stream;
        await v.play();
        setLive(true);
        track.current = stream.getVideoTracks()[0] ?? null;
        const caps = track.current?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
        if (caps?.torch) setTorch(false);
        const detector = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        while (!stop) {
          let texts: string[] = [];
          if (detector) {
            texts = (await detector.detect(v).catch(() => [])).map((c) => c.rawValue);
          } else if (ctx && v.videoWidth) {
            // Scale down before decoding: faster, and plenty for a code held up to the camera.
            const scale = Math.min(1, 640 / v.videoWidth);
            canvas.width = Math.round(v.videoWidth * scale);
            canvas.height = Math.round(v.videoHeight * scale);
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const hit = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
            if (hit) texts = [hit.data];
          }
          const token = texts.map(klickToken).find(Boolean);
          if (token) return navigate(`/k/${token}`, { replace: true });
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch (e) {
        setCameraError(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Camera access is blocked. Allow it in your browser settings, or paste their link instead."
            : e instanceof DOMException && e.name === "NotFoundError"
              ? "No camera found. Paste their link instead."
              : e instanceof Error
                ? e.message
                : String(e),
        );
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [navigate]);

  async function toggleTorch() {
    if (torch === null || !track.current) return;
    try {
      await track.current.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch(!torch);
    } catch {
      setTorch(null);
    }
  }

  const close = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));

  return (
    <div className="k-scanner">
      <div className="k-scanner__camera" aria-hidden="true">
        <video ref={video} muted playsInline className={live ? "k-scanner__video--live" : ""} />
      </div>

      <header className="k-scanner__bar">
        <button type="button" className="k-scanner__icon" aria-label="Close scanner" onClick={close}>
          <X className="pd-i" aria-hidden="true" />
        </button>
        <h1>Scan a Klick QR</h1>
        {torch === null ? (
          <span className="k-scanner__icon k-scanner__icon--empty" aria-hidden="true" />
        ) : (
          <button type="button" className="k-scanner__icon" aria-label={torch ? "Turn off torch" : "Turn on torch"} aria-pressed={torch} onClick={toggleTorch}>
            <Flashlight className="pd-i" aria-hidden="true" />
          </button>
        )}
      </header>

      <div className="k-scanner__body">
        <div className="k-scanner__frame" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          {live && <i className="k-scanner__line" />}
        </div>
        {cameraError ? (
          <p className="k-scanner__hint" role="alert">
            {cameraError}
          </p>
        ) : (
          <>
            <p className="k-scanner__hint">{live ? "Point at someone's Klick QR" : "Starting the camera…"}</p>
            <p className="k-scanner__sub">Scanning shows their profile first. Nothing is shared until you both accept.</p>
          </>
        )}
      </div>

      <div className="k-scanner__actions">
        <button type="button" className="k-scanner__btn k-scanner__btn--soft" onClick={() => setPasting(true)}>
          <Keyboard className="pd-i" aria-hidden="true" />
          Paste a link instead
        </button>
        <Link to="/profile?qr=1" className="k-scanner__btn">
          <QrCode className="pd-i" aria-hidden="true" />
          Show my QR
        </Link>
      </div>

      {pasting && <PasteSheet onClose={() => setPasting(false)} />}
    </div>
  );
}
