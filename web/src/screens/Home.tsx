import { Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import Header from "../layout/Header";
import Block from "../ui/Block";
import EventCard from "../ui/EventCard";
import { Api } from "../lib/api";
import { useMe } from "../lib/me";
import { useLoad } from "../lib/useLoad";
import { isPast } from "../lib/eventFormat";

export default function Home() {
  const { me } = useMe();
  const first = me?.displayName.split(" ")[0];
  const { data } = useLoad(() => Api.events());
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
