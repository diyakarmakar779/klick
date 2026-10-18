import { Link } from "react-router-dom";
import { BookmarkCheck, Check, ChevronRight, CircleCheck, Clock, Image as ImageIcon, MessageCircle, User, Users } from "lucide-react";
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
  chatTo,
}: {
  event: KlickEvent;
  to: string;
  past: boolean;
  badge: BadgeKind | null;
  worth: PeopleSignal | null;
  catchUp: PeopleSignal | null;
  prep: string | null;
  saved?: boolean;
  chatTo?: string;
}) {
  const b = badge ? BADGE[badge] : null;
  return (
    <article className="k-ecard">
      <Link to={to} className="k-card-link" aria-label={`Open ${event.title}`} />
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
      {chatTo && (
        <Link to={chatTo} className="pd-btn pd-btn--outline pd-btn--sm k-card-action k-ecard__chat">
          <MessageCircle className="pd-i" aria-hidden="true" />
          Ask Klick AI
        </Link>
      )}
    </article>
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
  return <CardView event={event} to={`/events/${event.id}`} past={past} badge={badge} worth={worth} catchUp={catchUp} prep={prep} chatTo={`/events/${event.id}/ask`} />;
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

// Compact row: thumbnail, title, date, then the status when something is pending or a one-line
// people summary. A past row shows "Went" only when attendance was verified.
export function EventRow({ item }: { item: MyEvent }) {
  const { event, people } = item;
  const { badge } = status(item);
  const parts = [
    people.worthMeeting.count > 0 && `${people.worthMeeting.count} worth meeting`,
    people.catchUp.count > 0 && `${people.catchUp.count} to catch up`,
  ].filter(Boolean);
  return (
    <Link to={`/events/${event.id}`} className="k-erow">
      <span className="k-erow__thumb">
        {event.coverImageUrl ? <img src={event.coverImageUrl} alt="" loading="lazy" /> : <ImageIcon className="pd-i" aria-hidden="true" />}
      </span>
      <span className="k-erow__body">
        <b>{event.title}</b>
        <span className="k-ecard__date">{dateLine(event)}</span>
        {isPast(event) ? (
          badge === "went" && (
            <span className="k-status k-status--went">
              <Check className="pd-i" aria-hidden="true" />
              Went
            </span>
          )
        ) : badge === "pending" ? (
          <span className="k-status k-status--pending">
            <Clock className="pd-i" aria-hidden="true" />
            Pending
          </span>
        ) : (
          parts.length > 0 && (
            <span className="k-erow__people">
              <Users className="pd-i" aria-hidden="true" />
              {parts.join(" · ")}
            </span>
          )
        )}
      </span>
      <ChevronRight className="pd-i k-erow__chev" aria-hidden="true" />
    </Link>
  );
}
