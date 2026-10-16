import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bookmark, BookmarkCheck, CalendarDays, ExternalLink, Image as ImageIcon, Info, MapPin, Sparkles, Users } from "lucide-react";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import SectionHead from "../../ui/SectionHead";
import { ConnectedRow } from "../../ui/PersonRow";
import { Api } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { whenLong, where } from "../../lib/eventFormat";

// An event you aren't on yet, reached through a Klick going. Your Klicks come first; everyone else stays a count
// until you plan to attend, and then only people who chose to be found.
export default function DiscoverEvent() {
  const { eventId = "" } = useParams();
  const navigate = useNavigate();
  const { data, setData, error, reload } = useLoad(() => Api.discoverEvent(eventId), [eventId]);
  const [busy, setBusy] = useState<"plan" | null>(null);
  const [actionError, setActionError] = useState("");

  const back = (
    <Link to="/events?tab=discover" className="pd-btn pd-btn--ghost pd-btn--icon k-back" aria-label="Back to Discover">
      <ArrowLeft className="pd-i" aria-hidden="true" />
    </Link>
  );

  if (error)
    return (
      <div className="pd-page pd-page--narrow k-stack">
        {back}
        {error.status === 404 ? (
          <Alert title="This event isn't in Discover">Klick shows events here only while one of your Klicks is going.</Alert>
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

  const { event } = data;
  const place = where(event);
  const n = data.catchUp.length;

  async function plan() {
    setBusy("plan");
    setActionError("");
    try {
      await Api.planToAttend(eventId);
      navigate(`/events/${eventId}`, { replace: true });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  async function toggleSave() {
    const on = !data!.saved;
    setData((d) => d && { ...d, saved: on });
    try {
      await Api.saveEvent(eventId, on);
    } catch (e) {
      setData((d) => d && { ...d, saved: !on });
      setActionError(e instanceof Error ? e.message : String(e));
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
          <small className="k-ehero__why">
            <Users className="pd-i" aria-hidden="true" />
            Suggested because {n === 1 ? "one of your Klicks is" : `${n} of your Klicks are`} going
          </small>
          <div className="k-row k-ehero__cta">
            <Button variant="brand" className="k-grow" loading={busy === "plan"} onClick={plan}>
              Plan to attend
            </Button>
            <Button variant="outline" aria-pressed={data.saved} onClick={toggleSave}>
              {data.saved ? <BookmarkCheck className="pd-i" aria-hidden="true" /> : <Bookmark className="pd-i" aria-hidden="true" />}
              {data.saved ? "Saved" : "Save"}
            </Button>
          </div>
          <small className="k-ehero__source">Planning to attend doesn't register you. Use the organiser's link to RSVP.</small>
          {event.url && (
            <a className="pd-btn pd-btn--link k-ehero__link k-self-start" href={event.url} target="_blank" rel="noreferrer">
              View event page
              <ExternalLink className="pd-i" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>

      <div className="pd-page pd-page--narrow k-epage">
        {actionError && <Alert tone="warning" title={actionError} />}

        <section className="k-esection">
          <div className="k-tier">
            <SectionHead title="Worth meeting" />
            <div className="k-locked">
              <b>
                <Sparkles className="pd-i" aria-hidden="true" />
                {data.worthMeeting.count ? `${data.worthMeeting.label} people worth meeting` : "See who's worth meeting"}
              </b>
              <p>Plan to attend and tell us why you're going to see who. They'll see you the same way.</p>
            </div>
          </div>

          <div className="k-tier">
            <SectionHead title="Catch up" count={n} />
            {data.catchUp.map((c) => (
              <ConnectedRow key={c.connectionId} item={c} />
            ))}
          </div>

          <p className="k-coverage">
            <Info className="pd-i" aria-hidden="true" />
            {data.othersGoing.count
              ? `${data.othersGoing.label} more people on Klick are going. You'll see members who chose to be found once you plan to attend.`
              : "You'll see members who chose to be found once you plan to attend. Klick never shows a guest list."}
          </p>
        </section>

        {event.description && (
          <section className="k-esection">
            <SectionHead title="About" />
            <p className="k-description">{event.description}</p>
          </section>
        )}
      </div>
    </>
  );
}
