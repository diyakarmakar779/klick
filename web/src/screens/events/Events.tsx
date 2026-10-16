import { useState } from "react";
import { CalendarDays, Sparkles } from "lucide-react";
import Header from "../../layout/Header";
import Block from "../../ui/Block";
import Button from "../../ui/Button";
import Alert from "../../ui/Alert";
import EventCard from "../../ui/EventCard";
import { Api } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { isPast } from "../../lib/eventFormat";
import { connectCalendar } from "../../lib/sources";

type View = "upcoming" | "past";

// The member's own events from connected sources. Upcoming soonest first, past most recent first.
export default function Events() {
  const { data, error, reload } = useLoad(() => Api.events());
  const [view, setView] = useState<View>("upcoming");
  const [busy, setBusy] = useState<"calendar" | "demo" | null>(null);
  const [connectError, setConnectError] = useState("");

  async function connect(which: "calendar" | "demo") {
    setBusy(which);
    setConnectError("");
    try {
      await (which === "calendar" ? connectCalendar() : Api.joinDemoEvents());
      await reload();
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const list = (data ?? [])
    .filter((m) => (view === "past" ? isPast(m.event) : !isPast(m.event)))
    .sort((a, b) => {
      const d = new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime();
      return view === "past" ? -d : d;
    });

  return (
    <>
      <Header title="Events" />
      <div className="pd-page k-stack">
        <div className="pd-seg" role="tablist" aria-label="Which events">
          {(["upcoming", "past"] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}>
              {v === "upcoming" ? "Upcoming" : "Past"}
            </button>
          ))}
        </div>

        {error && (
          <Alert
            tone="destructive"
            title="Klick couldn't load your events"
            action={
              <Button variant="outline" size="sm" onClick={reload}>
                Retry
              </Button>
            }
          >
            Check your connection and try again.
          </Alert>
        )}
        {connectError && <Alert tone="warning" title={connectError} />}

        {data === undefined && !error && <div className="k-spinner">Loading…</div>}

        {data && list.length > 0 && (
          <div className="k-list">
            {list.map((m) => (
              <EventCard key={m.event.id} item={m} />
            ))}
          </div>
        )}

        {data && list.length === 0 && (
          <div className="k-empty">
            <Block studs={4} unit={14} />
            <h2>{view === "past" ? "No past events yet" : "Nothing coming up"}</h2>
            <p>
              {view === "past"
                ? "Events you've been to will show up here, with the people you met."
                : "Klick finds the events you're hosting or going to in your calendar and Luma."}
            </p>
            {view === "upcoming" && (
              <div className="k-row">
                <Button variant="primary" loading={busy === "calendar"} onClick={() => connect("calendar")}>
                  <CalendarDays className="pd-i" aria-hidden="true" />
                  Sync Google Calendar
                </Button>
                <Button variant="outline" loading={busy === "demo"} onClick={() => connect("demo")}>
                  <Sparkles className="pd-i" aria-hidden="true" />
                  Try demo events
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
