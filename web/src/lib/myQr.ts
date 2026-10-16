import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Api } from "./api";
import { useLoad } from "./useLoad";
import { canBeMatched, isPast } from "./eventFormat";

// My QR: a short-lived code that opens /k/<token>. Scanning shows only name, role and company.
// The code is tied to "where you met" (the next event you're going to by default) and refreshes
// itself just before it expires.
export function useMyQr() {
  const events = useLoad(() => Api.events());
  const options = (events.data ?? [])
    .filter((m) => canBeMatched(m.state) && !isPast(m.event))
    .sort((a, b) => new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime());
  const [eventId, setEventId] = useState<string | null | undefined>(undefined);
  const [code, setCode] = useState<{ svg: string; url: string; expiresAt: number } | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

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

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (code && now > code.expiresAt - 15_000) void make();
  }, [now, code, make]);

  const left = code ? Math.max(0, Math.round((code.expiresAt - now) / 1000)) : 0;
  return { events, options, eventId, setEventId, code, error, make, left };
}
