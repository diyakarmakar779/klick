import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, CircleCheck, ExternalLink, Eye, Image as ImageIcon, Info, MapPin, Sparkles } from "lucide-react";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import ShareSheet from "../../ui/ShareSheet";
import { ConnectedRow, RecommendedRow, ViewOnlyRow } from "../../ui/PersonRow";
import { Api, type Match } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { firstName } from "../../lib/people";
import { PARTICIPATION, SOURCE_LABEL, ago, canBeMatched, isPast, whenLong, where } from "../../lib/eventFormat";

const SHOWN_MATCHES = 2;

function SectionHead({ title, count, action }: { title: string; count?: number; action?: ReactNode }) {
  return (
    <div className="k-shead">
      <h3>
        {title}
        {count !== undefined && <span className="k-count">{count}</span>}
      </h3>
      {action}
    </div>
  );
}

// One of the member's own events: the event, getting ready, and who's going in three tiers.
// Catch up is private to the member, Worth meeting is reciprocal, Also going is names only. Never a guest list.
export default function EventPage() {
  const { eventId = "" } = useParams();
  const { data, setData, error, reload } = useLoad(() => Api.event(eventId), [eventId]);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState<"goal" | "visibility" | null>(null);
  const [actionError, setActionError] = useState("");
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [asking, setAsking] = useState<Match | null>(null);

  useEffect(() => setGoal(data?.goal ?? ""), [data?.goal]);

  const visible = data?.effectiveVisibility === "confirmed_attendees";
  const matchable = !!data && canBeMatched(data.state);
  const past = !!data && isPast(data.event);
  const findable = matchable && visible && !past;

  // Suggestions load with the page once the member can see them (and be seen).
  useEffect(() => {
    if (!findable) return setMatches(null);
    let live = true;
    Api.matches(eventId)
      .then((r) => live && setMatches(r.matches))
      .catch(() => live && setMatches([]));
    return () => {
      live = false;
    };
  }, [eventId, findable]);

  const back = (
    <Link to="/events" className="pd-btn pd-btn--ghost pd-btn--icon k-back" aria-label="Back to events">
      <ArrowLeft className="pd-i" aria-hidden="true" />
    </Link>
  );

  if (error)
    return (
      <div className="pd-page pd-page--narrow k-stack">
        {back}
        {error.status === 404 ? (
          <Alert title="This event isn't in your list">Klick only shows events you're hosting, invited to or going to.</Alert>
        ) : (
          <Alert tone="destructive" title="Klick couldn't load this event" action={<Button variant="outline" size="sm" onClick={reload}>Retry</Button>}>
            Check your connection and try again.
          </Alert>
        )}
      </div>
    );
  if (!data)
    return (
      <div className="pd-page pd-page--narrow k-stack">
        {back}
        <div className="k-spinner">Loading…</div>
      </div>
    );

  const { event, state } = data;
  const participation = PARTICIPATION[state];
  const place = where(event);
  const source = SOURCE_LABEL[data.provenance.source] ?? data.provenance.source;
  const real = data.provenance.source === "google_calendar" || data.provenance.source === "luma_mcp";

  const shownMatches = (matches ?? []).filter((m) => !hidden.has(m.memberId));
  const matchedIds = new Set((matches ?? []).map((m) => m.memberId));
  const alsoGoing = data.alsoGoing.filter((p) => !matchedIds.has(p.id));

  async function toggleVisible(on: boolean) {
    setSaving("visibility");
    setActionError("");
    try {
      await Api.setVisibility(eventId, on ? "confirmed_attendees" : "hidden");
      setData((d) => d && { ...d, visibility: on ? "confirmed_attendees" : "hidden", effectiveVisibility: on ? "confirmed_attendees" : "hidden" });
      void reload(); // who's going changes with it
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
      setEditingGoal(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <div className="k-ehero">
        <div className="pd-page pd-page--narrow k-ehero__inner">
          <div className="k-ehero__bar">{back}</div>
          <div className="k-ehero__poster">
            {event.coverImageUrl ? <img src={event.coverImageUrl} alt="" /> : <ImageIcon className="k-ecard__ph" aria-hidden="true" />}
          </div>
          <h1>{event.title}</h1>
          <ul className="k-ehero__facts">
            <li>
              <CalendarDays className="pd-i" aria-hidden="true" />
              {whenLong(event)}
            </li>
            {place && (
              <li>
                <MapPin className="pd-i" aria-hidden="true" />
                {place}
              </li>
            )}
          </ul>
          <div>
            <small className="k-ehero__source">
              {real ? `From ${source}` : "Demo event"}
              {data.syncedAt && `, synced ${ago(data.syncedAt)}`}
            </small>
            {event.url && (
              <a className="pd-btn pd-btn--link k-ehero__link" href={event.url} target="_blank" rel="noreferrer">
                {real ? `View on ${source}` : "View event page"}
                <ExternalLink className="pd-i" aria-hidden="true" />
              </a>
            )}
          </div>
          {participation && (
            <span className="k-participation">
              <CircleCheck className="pd-i" aria-hidden="true" />
              {participation}
            </span>
          )}
        </div>
      </div>

      <div className="pd-page pd-page--narrow k-epage">
        {actionError && <Alert tone="warning" title={actionError} />}

        {!matchable && !past && (
          <Alert title="Klick suggests people once you're going">If you've registered, it'll show up after your next sync.</Alert>
        )}

        {matchable && !past && (
          <section className="k-esection">
            <SectionHead title="Get ready" />
            <div className="k-ready">
              <div className="k-ready__row">
                <div className="k-grow">
                  <b>Why you're going</b>
                  {editingGoal ? (
                    <>
                      <textarea
                        className="pd-input k-textarea"
                        rows={3}
                        maxLength={280}
                        autoFocus
                        aria-label="Why you're going"
                        placeholder="Meet people building climate tools, and find a co-founder."
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                      />
                      <div className="k-row">
                        <Button variant="primary" size="sm" loading={saving === "goal"} onClick={saveGoal}>
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setGoal(data.goal ?? "");
                            setEditingGoal(false);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                      <small className="k-muted">Only used to explain your suggestions to you.</small>
                    </>
                  ) : (
                    <p className={data.goal ? "" : "k-muted"}>{data.goal ?? "Add a line so your suggestions fit what you're here for."}</p>
                  )}
                </div>
                {!editingGoal && (
                  <button type="button" className="pd-btn pd-btn--link k-ready__edit" onClick={() => setEditingGoal(true)}>
                    {data.goal ? "Edit" : "Add"}
                  </button>
                )}
              </div>
              <hr />
              <div className="k-ready__row">
                <div className="k-grow">
                  <b>Let members at this event find you</b>
                  {visible && (
                    <span className="k-status k-status--private k-self-start">
                      <Eye className="pd-i" aria-hidden="true" />
                      Event-visible
                    </span>
                  )}
                  <small className="k-muted">
                    {visible ? "Only members who are also going can see you. Change it anytime." : "Nobody here can find you, and you won't see who's worth meeting."}
                  </small>
                </div>
                <button
                  type="button"
                  className="pd-switch"
                  role="switch"
                  aria-checked={visible}
                  aria-label="Let members at this event find you"
                  disabled={saving === "visibility"}
                  onClick={() => toggleVisible(!visible)}
                />
              </div>
            </div>
          </section>
        )}

        <section className="k-esection">
          <SectionHead title="Who's going" />

          {!past && matchable && (
            <div className="k-tier">
              {findable ? (
                <>
                  <SectionHead
                    title="Worth meeting"
                    count={matches ? shownMatches.length : undefined}
                    action={
                      shownMatches.length > SHOWN_MATCHES && (
                        <Link to={`/events/${eventId}/people`} className="pd-btn pd-btn--link pd-btn--sm">
                          See all
                        </Link>
                      )
                    }
                  />
                  {matches === null && <div className="k-spinner">Finding people worth meeting…</div>}
                  {matches && shownMatches.length === 0 && (
                    <p className="k-muted">No one yet. As more people going choose to be found, they'll show up here.</p>
                  )}
                  {shownMatches.slice(0, SHOWN_MATCHES).map((m) => (
                    <RecommendedRow
                      key={m.memberId}
                      match={m}
                      sent={sent.has(m.memberId)}
                      onRequest={() => setAsking(m)}
                      onHide={() => setHidden((s) => new Set(s).add(m.memberId))}
                    />
                  ))}
                </>
              ) : (
                <>
                  <SectionHead title="Worth meeting" />
                  <div className="k-locked">
                    <b>
                      <Sparkles className="pd-i" aria-hidden="true" />
                      {data.discoverable.count ? `${data.discoverable.label} people can be found here` : "See who's worth meeting"}
                    </b>
                    <p>Turn on "Let members at this event find you" to see who. They'll see you the same way.</p>
                  </div>
                </>
              )}
            </div>
          )}

          {data.catchUp.length > 0 && (
            <div className="k-tier">
              <SectionHead title="Catch up" count={data.catchUp.length} />
              {data.catchUp.map((c) => (
                <ConnectedRow key={c.connectionId} item={c} />
              ))}
            </div>
          )}

          {findable && alsoGoing.length > 0 && (
            <div className="k-tier">
              <SectionHead title="Also going" count={alsoGoing.length} />
              <p className="k-muted k-tier__hint">Members who chose to be found. View only.</p>
              <div className="k-viewlist">
                {alsoGoing.map((p) => (
                  <ViewOnlyRow key={p.id} person={p} />
                ))}
              </div>
            </div>
          )}

          <p className="k-coverage">
            <Info className="pd-i" aria-hidden="true" />
            {data.notShown
              ? `${data.notShown} more people on Klick are going but haven't chosen to be found, so they aren't shown.`
              : `${data.onPlatformGoing.label} people on Klick are going. Klick never shows a guest list.`}
          </p>
        </section>

        {event.description && (
          <section className="k-esection">
            <SectionHead title="About" />
            <p className="k-description">{event.description}</p>
          </section>
        )}
      </div>

      {asking && (
        <ShareSheet
          title={`Request a Klick with ${firstName(asking.profile?.displayName ?? "them")}`}
          description="Choose what they see if they accept. Until then they only see your name, role and note."
          cta={(n) => (n ? `Send request and share ${n} field${n === 1 ? "" : "s"}` : "Send request")}
          withNote
          onClose={() => setAsking(null)}
          onSubmit={async (fields, note) => {
            await Api.requestKlick({ to: asking.memberId, eventId, context: note, shareFields: fields });
            setSent((s) => new Set(s).add(asking.memberId));
            setAsking(null);
          }}
        />
      )}
    </>
  );
}
