import { useEffect, useState } from "react";
import { CalendarDays, Check, Sparkles, Ticket } from "lucide-react";
import { Api, ApiError } from "../../lib/api";
import { useMe } from "../../lib/me";
import { connectCalendar, startRedirect } from "../../lib/sources";
import Button from "../../ui/Button";
import Steps from "./Steps";

type Busy = "calendar" | "luma" | "demo" | "next" | null;

// Step 2: connect where your events live. Klick reads only events you're part of, never guest lists.
export default function Sources() {
  const { setMe } = useMe();
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

  const row = (key: string, icon: React.ReactNode, title: string, body: string, action: () => void, which: Busy) => (
    <div className="k-source">
      <span className="k-source__icon">{icon}</span>
      <div className="k-source__body">
        <b>{title}</b>
        <small>{body}</small>
      </div>
      {connected[key] ? (
        <span className="pd-badge pd-badge--success">
          <Check className="pd-i" aria-hidden="true" />
          Connected
        </span>
      ) : (
        <Button variant="outline" size="sm" loading={busy === which} onClick={action}>
          Connect
        </Button>
      )}
    </div>
  );

  return (
    <div className="k-flow">
      <div className="pd-page pd-page--narrow">
        <Steps step={2} />
        <h1 className="title">Where do your events live?</h1>
        <p className="k-muted" style={{ marginTop: "var(--space-3)", marginBottom: "var(--space-6)" }}>
          Klick reads only the events you're part of. It never reads guest lists or contacts anyone for you.
        </p>
        {row("google_calendar", <CalendarDays className="pd-i" />, "Google Calendar", "Read-only. Flights and reminders are skipped.", calendar, "calendar")}
        {row("luma_mcp", <Ticket className="pd-i" />, "Luma", "Events you're hosting or registered for.", luma, "luma")}
        {row("mock_luma", <Sparkles className="pd-i" />, "Demo events", "Try Klick with sample events and people.", demo, "demo")}
        {note && (
          <p className="k-caption" role="status" style={{ marginTop: "var(--space-4)" }}>
            {note}
          </p>
        )}
        <div className="k-flow__foot">
          {error && (
            <p className="pd-error" role="alert">
              {error}
            </p>
          )}
          <Button variant="primary" size="lg" loading={busy === "next"} onClick={next}>
            {any ? "Continue" : "Skip for now"}
          </Button>
        </div>
      </div>
    </div>
  );
}
