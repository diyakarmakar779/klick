import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import jsQR from "jsqr";
import { ClipboardPaste, QrCode } from "lucide-react";
import Header from "../../layout/Header";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";

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

// Scanner: the QR button in the nav opens straight here. The camera reads codes with the browser's
// BarcodeDetector where it exists and jsQR everywhere else (iPhone Safari). If the camera is
// blocked or missing, pasting their link works the same way.
export default function Scan() {
  const video = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  const [cameraError, setCameraError] = useState("");
  const [live, setLive] = useState(false);
  const [pasted, setPasted] = useState("");
  const [pasteError, setPasteError] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser can't open the camera. Paste their link below instead.");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const v = video.current;
        if (!v || stop) return;
        v.srcObject = stream;
        await v.play();
        setLive(true);
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
            ? "Camera access is blocked. Allow it in your browser settings, or paste their link below."
            : e instanceof DOMException && e.name === "NotFoundError"
              ? "No camera found. Paste their link below instead."
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

  function openPasted(e: FormEvent) {
    e.preventDefault();
    const token = klickToken(pasted);
    if (!token) return setPasteError("That isn't a Klick link. It looks like klick…/k/ followed by letters and numbers.");
    navigate(`/k/${token}`);
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      setPasted(text);
      setPasteError("");
    } catch {
      setPasteError("Klick can't read your clipboard. Long-press the box and choose Paste.");
    }
  }

  return (
    <>
      <Header
        title="Scan"
        action={
          <Link to="/profile?qr=1" className="pd-btn pd-btn--outline pd-btn--sm">
            <QrCode className="pd-i" aria-hidden="true" />
            My QR
          </Link>
        }
      />
      <div className="pd-page pd-page--narrow k-stack">
        {cameraError ? <Alert tone="warning" title={cameraError} /> : <p className="k-muted">Point your camera at someone's Klick code.</p>}
        {!cameraError && (
          <div className="k-scan">
            <video ref={video} muted playsInline aria-label="Camera preview" />
            <span className="k-scan__frame" aria-hidden="true" />
            {!live && <span className="k-scan__wait">Starting the camera…</span>}
          </div>
        )}

        <form className="k-paste" onSubmit={openPasted}>
          <label htmlFor="paste-link">
            <b>Can't scan?</b> Paste the link they shared.
          </label>
          <div className="k-paste__row">
            <input
              id="paste-link"
              className="pd-input"
              value={pasted}
              placeholder="https://…/k/…"
              autoComplete="off"
              onChange={(e) => {
                setPasted(e.target.value);
                setPasteError("");
              }}
            />
            {"clipboard" in navigator && "readText" in navigator.clipboard && (
              <Button type="button" variant="outline" size="icon" aria-label="Paste from clipboard" onClick={pasteFromClipboard}>
                <ClipboardPaste className="pd-i" aria-hidden="true" />
              </Button>
            )}
          </div>
          {pasteError && <p className="k-error">{pasteError}</p>}
          <Button type="submit" variant="brand" disabled={!pasted.trim()}>
            Open
          </Button>
        </form>
      </div>
    </>
  );
}
