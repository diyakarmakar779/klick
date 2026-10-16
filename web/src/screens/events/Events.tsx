import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, Check, Sparkles } from "lucide-react";
import Header from "../../layout/Header";
import Block from "../../ui/Block";
import Button from "../../ui/Button";
import Alert from "../../ui/Alert";
import EventCard, { DiscoverCard } from "../../ui/EventCard";
import { Api } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { isPast } from "../../lib/eventFormat";
import { connectCalendar } from "../../lib/sources";

type View = "upcoming" | "past";
type Filter = "circle" | "matches" | "week";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "circle", label: "Your circle" },
  { id: "matches", label: "Best matches" },
  { id: "week", label: "This week" },
];

// Discover: upcoming events where your Klicks are going. Never a catalogue.
function Discover() {
  const { data, error, reload } = useLoad(() => Api.discover());
  const [filter, setFilter] = useState<Filter>("circle");
  const week = Date.now() + 7 * 86400000;
  const list = (data ?? [])
    .filter((d) => filter !== "week" || new Date(d.event.startsAt).getTime() <= week)
    .sort((a, b) =>
      filter === "matches"
        ? (b.worthMeeting.count ?? 0) - (a.worthMeeting.count ?? 0)
        : filter === "circle"
          ? b.catchUp.count - a.catchUp.count || new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime()
          : new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime(),
    );
  return (
    <>
      <p className="k-muted k-discover__intro">Events with people worth meeting, or where your Klicks are going.</p>
      <div className="k-chips" role="radiogroup" aria-label="Filter events">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} className="k-chip" onClick={() => setFilter(f.id)}>
            {filter === f.id && <Check className="pd-i" aria-hidden="true" />}
            {f.label}
          </button>
        ))}
      </div>
      {error && (
        <Alert tone="destructive" title="Klick couldn't load Discover" action={<Button variant="outline" size="sm" onClick={reload}>Retry</Button>}>
          Check your connection and try again.
        </Alert>
      )}
      {data === undefined && !error && <div className="k-spinner">Loading…</div>}
      {data && list.length > 0 && (
        <>
          <div className="k-list">
            {list.map((d) => (
              <DiscoverCard key={d.event.id} item={d} />
            ))}
          </div>
          <p className="k-muted k-note">Counts include only people who let their Klicks see this event.</p>
        </>
      )}
      {data && list.length === 0 && (
        <div className="k-empty">
          <Block studs={4} unit={14} />
          <h2>{filter === "week" && data.length > 0 ? "Nothing this week" : "Nothing to discover yet"}</h2>
          <p>When your Klicks are going to events you aren't, they show up here. Klick never lists events from strangers.</p>
        </div>
      )}
    </>
  );
}

// The member's own events from connected sources. Upcoming soonest first, past most recent first.
export default function Events() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "discover" ? "discover" : "yours";
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
        <div className="k-seg" role="tablist" aria-label="Your events or discover">
          {(["yours", "discover"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setParams(t === "discover" ? { tab: t } : {}, { replace: true })}>
              {t === "yours" ? "Yours" : "Discover"}
            </button>
          ))}
        </div>

        {tab === "discover" ? (
          <Discover />
        ) : (
          <>
            <div className="k-tabs">
              <div className="k-tabs__list" role="tablist" aria-label="Which events">
                {(["upcoming", "past"] as const).map((v) => (
                  <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}>
                    {v === "upcoming" ? "Upcoming" : "Past"}
                  </button>
                ))}
              </div>
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
              </>
            )}
          </div>
    </>
  );
}
