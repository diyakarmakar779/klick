import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Building2, Clock, ExternalLink, MapPin, Users } from "lucide-react";
import Header from "../../layout/Header";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import SettingSwitch from "../../ui/Switch";
import { Api } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { PARTICIPATION, SOURCE_LABEL, canBeMatched, isPast, when, where } from "../../lib/eventFormat";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

// One of the member's own events: details, their discoverability, why they're going and counts. Never a guest list.
export default function EventPage() {
  const { eventId = "" } = useParams();
  const { data, setData, error, reload } = useLoad(() => Api.event(eventId), [eventId]);
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState<"goal" | "visibility" | null>(null);
  const [saved, setSaved] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => setGoal(data?.goal ?? ""), [data?.goal]);

  const back = (
    <Link to="/events" className="pd-btn pd-btn--ghost pd-btn--icon k-back" aria-label="Back to events">
      <ArrowLeft className="pd-i" aria-hidden="true" />
    </Link>
  );

  if (error)
    return (
      <>
        <Header title="Event" back={back} />
        <div className="pd-page k-stack">
          {error.status === 404 ? (
            <Alert title="This event isn't in your list">Klick only shows events you're hosting, invited to or going to.</Alert>
          ) : (
            <Alert tone="destructive" title="Klick couldn't load this event" action={<Button variant="outline" size="sm" onClick={reload}>Retry</Button>}>
              Check your connection and try again.
            </Alert>
          )}
        </div>
      </>
    );
  if (!data)
    return (
      <>
        <Header title="Event" back={back} />
        <div className="k-spinner">Loading…</div>
      </>
    );

  const { event, state } = data;
  const participation = PARTICIPATION[state];
  const visible = data.effectiveVisibility === "confirmed_attendees";
  const matchable = canBeMatched(state);
  const past = isPast(event);
  const place = where(event);

  async function toggleVisible(on: boolean) {
    setSaving("visibility");
    setActionError("");
    try {
      await Api.setVisibility(eventId, on ? "confirmed_attendees" : "hidden");
      setData((d) => d && { ...d, visibility: on ? "confirmed_attendees" : "hidden", effectiveVisibility: on ? "confirmed_attendees" : "hidden" });
      void reload(); // counts change with it
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  }

  async function saveGoal() {
    setSaving("goal");
    setActionError("");
    try {
      await Api.setGoal(eventId, goal.trim() || null);
      setData((d) => d && { ...d, goal: goal.trim() || null });
      setSaved(true);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <Header title="Event" back={back} />
      <div className="pd-page pd-page--narrow k-stack k-event">
        {event.coverImageUrl && <img className="k-cover" src={event.coverImageUrl} alt="" />}

        <div>
          <div className="pd-chips" style={{ marginBottom: "var(--space-3)" }}>
            {participation && <span className="pd-badge pd-badge--brand">{participation}</span>}
            <span className="pd-pill">{SOURCE_LABEL[data.provenance.source] ?? data.provenance.source}</span>
          </div>
          <h2 className="title">{event.title}</h2>
          <ul className="k-facts">
            <li>
              <Clock className="pd-i" aria-hidden="true" />
              {when(event)}
            </li>
            {place && (
              <li>
                <MapPin className="pd-i" aria-hidden="true" />
                {place}
              </li>
            )}
            {event.organizerName && (
              <li>
                <Building2 className="pd-i" aria-hidden="true" />
                By {event.organizerName}
              </li>
            )}
          </ul>
          {event.url && (
            <a className="pd-btn pd-btn--link k-event__link" href={event.url} target="_blank" rel="noreferrer">
              Event page
              <ExternalLink className="pd-i" aria-hidden="true" />
            </a>
          )}
        </div>

        {actionError && <Alert tone="warning" title={actionError} />}

        <section className="pd-card">
          {matchable ? (
            <SettingSwitch
              label="Visible to matches"
              hint={
                past
                  ? "This event has ended."
                  : visible
                    ? "People going who also turned this on can be suggested to you, and you to them."
                    : "Nobody here can find you. Turn on to see who's worth meeting."
              }
              checked={visible}
              disabled={saving === "visibility" || past}
              onChange={toggleVisible}
            />
          ) : (
            <p className="k-muted">
              Klick suggests people once you're going. If you've registered, it'll show up after your next sync.
            </p>
          )}
          {matchable && visible && !past && (
            <Link to={`/events/${eventId}/people`} className="pd-btn pd-btn--brand pd-btn--lg k-full" style={{ marginTop: "var(--space-4)" }}>
              <Users className="pd-i" aria-hidden="true" />
              See who to meet
            </Link>
          )}
        </section>

        {matchable && !past && (
          <section className="k-q">
            <label htmlFor="goal">
              <b>Why are you going?</b>
            </label>
            <textarea
              id="goal"
              className="pd-input k-textarea"
              rows={3}
              maxLength={280}
              placeholder="Meet people building climate tools, and find a co-founder."
              value={goal}
              onChange={(e) => {
                setGoal(e.target.value);
                setSaved(false);
              }}
            />
            <div className="k-row" style={{ justifyContent: "space-between" }}>
              <small className="k-muted">{saved ? "Saved. Your suggestions will use this." : "Only used to explain your matches to you."}</small>
              <Button variant="outline" size="sm" loading={saving === "goal"} disabled={goal.trim() === (data.goal ?? "")} onClick={saveGoal}>
                Save
              </Button>
            </div>
          </section>
        )}

        <section>
          <h3 className="k-section-title">Who's on Klick</h3>
          <div className="k-stats">
            <div className="pd-card">
              <b>{data.onPlatformGoing.label}</b>
              <small>going</small>
            </div>
            <div className="pd-card">
              <b>{data.discoverable.label}</b>
              <small>open to meeting</small>
            </div>
          </div>
          <p className="k-muted k-note">Klick shows counts, never a guest list. Small numbers show as "fewer than 3".</p>
        </section>

        {data.connectionsGoing.length > 0 && (
          <section>
            <h3 className="k-section-title">Your Klicks going</h3>
            <div className="k-list">
              {data.connectionsGoing.map((p) => (
                <div key={p.id} className="pd-person">
                  <span className="pd-avatar pd-avatar--brand">{initials(p.displayName)}</span>
                  <div>
                    <h4>{p.displayName}</h4>
                    <p>{p.headline || [p.role, p.company].filter(Boolean).join(", ")}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {event.description && (
          <section>
            <h3 className="k-section-title">About</h3>
            <p className="k-description">{event.description}</p>
          </section>
        )}
      </div>
    </>
  );
}
