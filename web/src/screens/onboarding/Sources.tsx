import { useEffect, useState } from "react";
import { CalendarDays, Check, ChevronRight, Info, Sparkles, Ticket } from "lucide-react";
import { Api, ApiError } from "../../lib/api";
import { useMe } from "../../lib/me";
import { connectCalendar, startRedirect } from "../../lib/sources";
import Button from "../../ui/Button";
import Flow, { FlowError, useGo } from "./Flow";

type Busy = "calendar" | "luma" | "demo" | "next" | null;

// Step 5: connect where your events live. Klick reads only events you're part of, never guest lists.
export default function Sources() {
  const { setMe } = useMe();
  const { go } = useGo();
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Busy>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Api.sources()
      .then((list) => setConnected(Object.fromEntries(list.map((s) => [s.provider, true]))))
      .catch(() => {});
  }, []);

  async function run(which: Busy, fn: () => Promise<string | void>) {
    setBusy(which);
    setError("");
    try {
      const msg = await fn();
      if (msg) setNote(msg);
    } catch (e) {
      setError(e instanceof ApiError ? `${e.message}. Try again.` : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const calendar = () =>
    run("calendar", async () => {
      const { imported } = await connectCalendar();
      setConnected((c) => ({ ...c, google_calendar: true }));
      return `Found ${imported} event${imported === 1 ? "" : "s"} in your calendar.`;
    });
  const luma = () => run("luma", () => startRedirect("luma", "/"));
  const demo = () =>
    run("demo", async () => {
      const { imported } = await Api.joinDemoEvents();
      setConnected((c) => ({ ...c, mock_luma: true }));
      return `Added ${imported} demo events with sample attendees.`;
    });
  const next = () => run("next", async () => setMe(await Api.finishIntegrations()));
  const any = Object.keys(connected).length > 0;

  const row = (key: string, Icon: typeof CalendarDays, title: string, body: string, action: () => void, which: Busy) => (
    <button type="button" className="k-srcrow" disabled={connected[key] || !!busy} onClick={action}>
      <span className="k-source__icon">
        <Icon className="pd-i" aria-hidden="true" />
      </span>
      <span className="k-grow">
        {title}
        <small>{busy === which ? "Connecting…" : body}</small>
      </span>
      {connected[key] ? (
        <span className="pd-badge pd-badge--success">
          <Check className="pd-i" aria-hidden="true" />
          Connected
        </span>
      ) : (
        <ChevronRight className="pd-i" aria-hidden="true" />
      )}
    </button>
  );

  return (
    <Flow
      step={5}
      onBack={() => go("identity")}
      title="Where do your events live?"
      sub="Klick finds your events from a source you authorise. Start with one, add more later."
      foot={
        <>
          <FlowError>{error}</FlowError>
          {any ? (
            <Button variant="primary" size="lg" loading={busy === "next"} disabled={!!busy} onClick={next}>
              Continue
            </Button>
          ) : (
            <>
              <button type="button" className="k-onb__link" disabled={!!busy} onClick={next}>
                Skip for now
              </button>
              <p className="k-caption k-center">Without a source you can still connect with people using your QR code.</p>
            </>
          )}
        </>
      }
    >
      <div className="k-onb__body">
        {row("google_calendar", CalendarDays, "Google Calendar", "Read-only. Flights and reminders are skipped.", calendar, "calendar")}
        {row("luma_mcp", Ticket, "Luma", "Events you're hosting or registered for.", luma, "luma")}
        {row("mock_luma", Sparkles, "Demo events", "Try Klick with sample events and people.", demo, "demo")}
        {note && (
          <p className="k-caption" role="status">
            {note}
          </p>
        )}
        <p className="k-note">
          <Info className="pd-i" aria-hidden="true" />
          <span>Klick reads event titles, dates and whether you're hosting, invited or planning to attend. It never changes your calendar or reads guest lists.</span>
        </p>
      </div>
    </Flow>
  );
}
