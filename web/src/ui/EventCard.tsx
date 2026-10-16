import { Link } from "react-router-dom";
import { BookmarkCheck, Check, CircleCheck, Clock, Image as ImageIcon, User } from "lucide-react";
import type { DiscoverItem, KlickEvent, MyEvent, PeopleSignal } from "../lib/api";
import { canBeMatched, dateLine, isPast } from "../lib/eventFormat";

type BadgeKind = "going" | "pending" | "went";

const BADGE: Record<BadgeKind, { label: string; Icon: typeof Check }> = {
  going: { label: "Going", Icon: CircleCheck },
  pending: { label: "Pending", Icon: Clock },
  went: { label: "Went", Icon: Check },
};

// Status from the member's own participation. "Went" only when a provider verified attendance;
// otherwise a past event asks rather than assumes.
function status(item: MyEvent): { badge: BadgeKind; prep: string | null } {
  const past = isPast(item.event);
  if (past) return item.state === "attended" ? { badge: "went", prep: null } : { badge: "pending", prep: "Did you go?" };
  if (!canBeMatched(item.state)) return { badge: "pending", prep: "Confirm you're going" };
  return { badge: "going", prep: item.goal ? null : "Add why you're going" };
}

function Avatars({ signal, tone, label }: { signal: PeopleSignal; tone: "brand" | "neutral"; label: string }) {
  const shown = Math.min(signal.count, 3);
  return (
    <div className="k-signal__col">
      <span className="k-signal__label">{label}</span>
      <div className={`k-avatars k-avatars--${tone}`} aria-label={`${signal.count} ${label.toLowerCase()}`}>
        {Array.from({ length: shown }, (_, i) => (
          <span key={i} className="k-avatars__a" aria-hidden="true">
            {signal.initials[i] || <User className="pd-i" />}
          </span>
        ))}
        {signal.count > 3 && (
          <span className="k-avatars__more" aria-hidden="true">
            +{signal.count - 3}
          </span>
        )}
      </div>
    </div>
  );
}

// Shared card body: poster with an optional status, title and date, people signal, one nudge.
function CardView({
  event,
  to,
  past,
  badge,
  worth,
  catchUp,
  prep,
  saved,
}: {
  event: KlickEvent;
  to: string;
  past: boolean;
  badge: BadgeKind | null;
  worth: PeopleSignal | null;
  catchUp: PeopleSignal | null;
  prep: string | null;
  saved?: boolean;
}) {
  const b = badge ? BADGE[badge] : null;
  return (
    <Link to={to} className="k-ecard">
      <div className={`k-ecard__poster${past ? " k-ecard__poster--past" : ""}`}>
        {event.coverImageUrl ? (
          <img src={event.coverImageUrl} alt="" loading="lazy" />
        ) : (
          <ImageIcon className="k-ecard__ph" aria-hidden="true" />
        )}
        {b && (
          <span className={`k-status k-status--${badge}`}>
            <b.Icon className="pd-i" aria-hidden="true" />
            {b.label}
          </span>
        )}
        {saved && (
          <span className="k-status k-status--went k-ecard__saved">
            <BookmarkCheck className="pd-i" aria-hidden="true" />
            Saved
          </span>
        )}
      </div>
      <div className="k-ecard__head">
        <h4>{event.title}</h4>
        <span className="k-ecard__date">{dateLine(event)}</span>
      </div>
      {(worth || catchUp) && (
        <div className="k-signal">
          {worth && <Avatars signal={worth} tone="brand" label="Worth meeting" />}
          {worth && catchUp && <span className="k-signal__rule" aria-hidden="true" />}
          {catchUp && <Avatars signal={catchUp} tone="neutral" label="Catch up" />}
        </div>
      )}
      {prep && (
        <span className="k-ecard__prep">
          <Clock className="pd-i" aria-hidden="true" />
          {prep}
        </span>
      )}
    </Link>
  );
}

// List card for one of the member's own events.
export default function EventCard({ item }: { item: MyEvent }) {
  const { event, people } = item;
  const past = isPast(event);
  const { badge, prep } = status(item);
  // Worth meeting is about who to meet next, so a past card only shows the people you know.
  const worth = past ? null : people.worthMeeting.count > 0 ? people.worthMeeting : null;
  const catchUp = people.catchUp.count > 0 ? people.catchUp : null;
  return <CardView event={event} to={`/events/${event.id}`} past={past} badge={badge} worth={worth} catchUp={catchUp} prep={prep} />;
}

// Discover card: no status (it isn't yours yet). Worth meeting is a count only, shown when it's big enough.
export function DiscoverCard({ item }: { item: DiscoverItem }) {
  const worth = item.worthMeeting.count ? { count: item.worthMeeting.count, initials: [] } : null;
  return (
    <CardView
      event={item.event}
      to={`/discover/${item.event.id}`}
      past={false}
      badge={null}
      worth={worth}
      catchUp={item.catchUp.count > 0 ? item.catchUp : null}
      prep={null}
      saved={item.saved}
    />
  );
}
