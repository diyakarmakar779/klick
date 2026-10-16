import { Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import Header from "../layout/Header";
import Block from "../ui/Block";
import EventCard from "../ui/EventCard";
import { Api } from "../lib/api";
import { useMe } from "../lib/me";
import { useLoad } from "../lib/useLoad";
import { isPast } from "../lib/eventFormat";
import { dueLabel } from "../lib/followups";
import { firstName, initials } from "../lib/people";

export default function Home() {
  const { me } = useMe();
  const first = me?.displayName.split(" ")[0];
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

  return (
    <>
      <Header title="Home" />
      <div className="pd-page k-stack">
        <div>
          <h2 className="title">{first ? `Hi ${first}` : "Hi"}</h2>
          <p className="k-muted" style={{ marginTop: "var(--space-2)" }}>
            {upcoming.length ? "Here's what's coming up. Open an event to see who's worth meeting." : "Your next events and the people worth meeting there will show up here."}
          </p>
        </div>
        {due.length > 0 && (
          <section>
            <h3 className="k-section-title">Follow up</h3>
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
          <section>
            <div className="k-section-head">
              <h3 className="k-section-title">Coming up</h3>
              <Link to="/events" className="pd-btn pd-btn--link pd-btn--sm">
                All events
              </Link>
            </div>
            <div className="k-list">
              {upcoming.map((m) => (
                <EventCard key={m.event.id} item={m} />
              ))}
            </div>
          </section>
        )}
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
