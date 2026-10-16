import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Header from "../../layout/Header";
import Alert from "../../ui/Alert";

interface Detector {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
  }
}

// In-app scanner where the browser has BarcodeDetector. Only Klick codes (/k/<token>) are followed.
export default function Scan() {
  const video = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    (async () => {
      try {
        if (!window.BarcodeDetector) throw new Error("This browser can't scan. Use your phone's camera app instead.");
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        while (!stop) {
          const codes = await detector.detect(video.current).catch(() => []);
          const hit = codes.map((c) => c.rawValue.match(/\/k\/([A-Za-z0-9_-]{10,})/)).find(Boolean);
          if (hit) return navigate(`/k/${hit[1]}`, { replace: true });
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch (e) {
        setError(e instanceof DOMException && e.name === "NotAllowedError" ? "Camera access was blocked. Allow it in your browser settings, or use your phone's camera app." : e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [navigate]);

  const back = (
    <Link to="/qr" className="pd-btn pd-btn--ghost pd-btn--icon k-back" aria-label="Back to my QR">
      <ArrowLeft className="pd-i" aria-hidden="true" />
    </Link>
  );
  return (
    <>
      <Header title="Scan" back={back} />
      <div className="pd-page pd-page--narrow k-stack">
        {error ? <Alert tone="warning" title={error} /> : <p className="k-muted">Point your camera at someone's Klick code.</p>}
        <div className="k-scan">
          <video ref={video} muted playsInline aria-label="Camera preview" />
          <span className="k-scan__frame" aria-hidden="true" />
        </div>
      </div>
    </>
  );
}
