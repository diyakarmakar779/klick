import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import Header from "../layout/Header";
import Block from "../ui/Block";
import EventCard, { EventRow } from "../ui/EventCard";
import SectionHead from "../ui/SectionHead";
import ShareSheet from "../ui/ShareSheet";
import { RecommendedRow } from "../ui/PersonRow";
import { Api, type Match, type MyEvent } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { canBeMatched, dayLong, isPast } from "../lib/eventFormat";
import { dueLabel } from "../lib/followups";
import { firstName, initials } from "../lib/people";

// The top suggestion for the member's next event they can be found at. Same reciprocal rule
// as the event page: nothing shows unless the member is going and visible there too.
function WorthMeetingNext({ item }: { item: MyEvent }) {
  const eventId = item.event.id;
  const [match, setMatch] = useState<Match | null>(null);
  const [saved, setSaved] = useState(false);
  const [sent, setSent] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([Api.matches(eventId), Api.event(eventId)])
      .then(([m, e]) => {
        if (!live) return;
        const top = m.matches[0] ?? null;
        setMatch(top);
        setSaved(!!top && e.saved.includes(top.memberId));
      })
      .catch(() => live && setMatch(null));
    return () => {
      live = false;
    };
  }, [eventId]);

  if (!match) return null;

  async function toggleSave() {
    if (!match) return;
    const on = !saved;
    setSaved(on);
    try {
      await (on ? Api.savePerson(eventId, match.memberId, match.reason || null) : Api.unsavePerson(eventId, match.memberId));
    } catch {
      setSaved(!on);
    }
  }

  return (
    <section>
      <SectionHead
        title="Worth meeting next"
        action={
          <Link to={`/events/${eventId}/people`} className="pd-btn pd-btn--link pd-btn--sm">
            See all
          </Link>
        }
      />
      <p className="k-home__for">
        For {item.event.title}, on {dayLong(item.event)}.
      </p>
      <RecommendedRow match={match} sent={sent} saved={saved} onRequest={() => setAsking(true)} onToggleSave={toggleSave} />
      {asking && (
        <ShareSheet
          title={`Request a Klick with ${firstName(match.profile?.displayName ?? "them")}`}
          description="Choose what they see if they accept. Until then they only see your name, role and note."
          cta={(n) => (n ? `Send request and share ${n} field${n === 1 ? "" : "s"}` : "Send request")}
          withNote
          onClose={() => setAsking(false)}
          onSubmit={async (fields, note) => {
            await Api.requestKlick({ to: match.memberId, eventId, context: note, shareFields: fields });
            setSent(true);
            setAsking(false);
          }}
        />
      )}
    </section>
  );
}

export default function Home() {
  const { data } = useLoad(() => Api.events());
  const fus = useLoad(() => Api.followUps());
  const klicks = useLoad(() => Api.connections("accepted"));
  const names = new Map((klicks.data ?? []).map((k) => [k.connection.id, k.other?.displayName ?? "Your Klick"]));
  // Follow-ups due in the next three days or overdue. Klick reminds; the member decides whether to reach out.
  const soon = Date.now() + 3 * 86_400_000;
  const due = (fus.data ?? [])
    .filter((f) => (f.status === "open" || f.status === "prompted") && new Date(f.dueAt).getTime() < soon)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    .slice(0, 3);
  const upcoming = (data ?? [])
    .filter((m) => !isPast(m.event))
    .sort((a, b) => new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime())
    .slice(0, 3);
  // The first upcoming event where the member is going and can be found.
  const next = upcoming.find((m) => canBeMatched(m.state) && m.effectiveVisibility === "confirmed_attendees");

  return (
    <>
      <Header title="Home" />
      <div className="pd-page k-stack k-home">
        {due.length > 0 && (
          <section>
            <SectionHead title="Follow up" />
            <div className="k-list">
              {due.map((f) => {
                const name = names.get(f.connectionId) ?? "Your Klick";
                const d = dueLabel(f.dueAt);
                return (
                  <Link key={f.id} to={`/klicks/${f.connectionId}`} className="pd-card k-home-fu">
                    <span className="pd-avatar pd-avatar--sm pd-avatar--brand">{initials(name)}</span>
                    <span className="k-grow">
                      <b style={{ display: "block", fontSize: 14 }}>{firstName(name)}</b>
                      <span className="k-muted" style={{ fontSize: 13.5 }}>{f.reason}</span>
                    </span>
                    <span className={`pd-intent__due ${d.overdue ? "k-overdue" : ""}`}>{d.text}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
        {upcoming.length > 0 && (
          <section className="k-home__events">
            <SectionHead
              title="Your upcoming events"
              action={
                <Link to="/events" className="pd-btn pd-btn--link pd-btn--sm">
                  See all
                </Link>
              }
            />
            <div className="k-list">
              <EventCard item={upcoming[0]} />
              {upcoming.slice(1).map((m) => (
                <EventRow key={m.event.id} item={m} />
              ))}
            </div>
          </section>
        )}
        {next && <WorthMeetingNext key={next.event.id} item={next} />}
        {data && upcoming.length === 0 && (
          <div className="k-empty">
            <Block studs={4} unit={14} />
            <h2>Nothing coming up yet</h2>
            <p>Connect Google Calendar or Luma and Klick will find the events you're part of.</p>
            <Link to="/events" className="pd-btn pd-btn--primary">
              <CalendarDays className="pd-i" aria-hidden="true" />
              Go to events
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
