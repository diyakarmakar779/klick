import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { RefreshCw, ScanLine } from "lucide-react";
import Header from "../../layout/Header";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import { Api } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { canBeMatched, isPast } from "../../lib/eventFormat";

// My QR: a short-lived code that opens /k/<token>. Scanning shows only name, role and company.
// The code works from any phone camera; the person scanning needs Klick to send a request.
export default function MyQr() {
  const events = useLoad(() => Api.events());
  const options = (events.data ?? [])
    .filter((m) => canBeMatched(m.state) && !isPast(m.event))
    .sort((a, b) => new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime());
  const [eventId, setEventId] = useState<string | null | undefined>(undefined);
  const [code, setCode] = useState<{ svg: string; url: string; expiresAt: number } | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  // Default to the next event you're going to, once the list loads.
  useEffect(() => {
    if (eventId === undefined && events.data) setEventId(options[0]?.event.id ?? null);
  }, [events.data, eventId, options]);

  const make = useCallback(async () => {
    if (eventId === undefined) return;
    setError("");
    try {
      const t = await Api.createQr(eventId);
      const url = `${window.location.origin}/k/${t.token}`;
      const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
      setCode({ svg, url, expiresAt: new Date(t.expiresAt).getTime() });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [eventId]);

  useEffect(() => {
    void make();
  }, [make]);

  // Tick for the countdown, and swap in a fresh code just before this one expires.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (code && now > code.expiresAt - 15_000) void make();
  }, [now, code, make]);

  const left = code ? Math.max(0, Math.round((code.expiresAt - now) / 1000)) : 0;
  const scanner = "BarcodeDetector" in window;

  return (
    <>
      <Header title="My QR" />
      <div className="pd-page pd-page--narrow k-stack k-qr-page">
        <p className="k-muted">Let someone you've just met scan this. They see your name, role and company, and nothing else until you both accept.</p>

        {options.length > 0 && (
          <label className="k-q" style={{ marginTop: 0 }}>
            <b>Where you met</b>
            <select className="pd-input" value={eventId ?? ""} onChange={(e) => setEventId(e.target.value || null)}>
              {options.map((m) => (
                <option key={m.event.id} value={m.event.id}>
                  {m.event.title}
                </option>
              ))}
              <option value="">Not at an event</option>
            </select>
          </label>
        )}

        {error && <Alert tone="destructive" title="Klick couldn't make your code" action={<Button variant="outline" size="sm" onClick={make}>Retry</Button>}>Check your connection and try again.</Alert>}

        <div className="k-qr">
          {code ? (
            <div className="k-qr__code" role="img" aria-label="Your Klick QR code" dangerouslySetInnerHTML={{ __html: code.svg }} />
          ) : (
            <div className="k-qr__code k-qr__code--loading" aria-hidden="true" />
          )}
          <p className="k-muted k-qr__timer" aria-live="polite">
            {code ? `Refreshes in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "Making your code…"}
            <button type="button" className="pd-btn pd-btn--ghost pd-btn--icon" aria-label="New code now" onClick={make}>
              <RefreshCw className="pd-i" aria-hidden="true" />
            </button>
          </p>
        </div>

        {scanner ? (
          <Link to="/scan" className="pd-btn pd-btn--outline pd-btn--lg">
            <ScanLine className="pd-i" aria-hidden="true" />
            Scan someone's code
          </Link>
        ) : (
          <p className="k-muted k-note" style={{ textAlign: "center" }}>
            To scan someone else's code, point your phone's camera at it.
          </p>
        )}
      </div>
    </>
  );
}
