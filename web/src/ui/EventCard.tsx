import { Link } from "react-router-dom";
import { Check, CircleCheck, Clock, Image as ImageIcon, User } from "lucide-react";
import type { MyEvent, PeopleSignal } from "../lib/api";
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

// List card for one of the member's own events: poster, status, date, and who's there for you.
export default function EventCard({ item }: { item: MyEvent }) {
  const { event, people } = item;
  const past = isPast(event);
  const { badge, prep } = status(item);
  const { label, Icon } = BADGE[badge];
  // Worth meeting is about who to meet next, so a past card only shows the people you know.
  const worth = past ? null : people.worthMeeting.count > 0 ? people.worthMeeting : null;
  const catchUp = people.catchUp.count > 0 ? people.catchUp : null;
  return (
    <Link to={`/events/${event.id}`} className="k-ecard">
      <div className={`k-ecard__poster${past ? " k-ecard__poster--past" : ""}`}>
        {event.coverImageUrl ? (
          <img src={event.coverImageUrl} alt="" loading="lazy" />
        ) : (
          <ImageIcon className="k-ecard__ph" aria-hidden="true" />
        )}
        <span className={`k-status k-status--${badge}`}>
          <Icon className="pd-i" aria-hidden="true" />
          {label}
        </span>
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
