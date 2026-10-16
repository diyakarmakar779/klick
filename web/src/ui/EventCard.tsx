import { Link } from "react-router-dom";
import { CalendarDays, Eye, MapPin, Ticket, Sparkles } from "lucide-react";
import type { MyEvent } from "../lib/api";
import { PARTICIPATION, SOURCE_LABEL, dateTab, where } from "../lib/eventFormat";

const SOURCE_ICON: Record<string, typeof CalendarDays> = { google_calendar: CalendarDays, luma_mcp: Ticket };

// List card for one of the member's own events. The date tab is the card's one brand fill.
export default function EventCard({ item }: { item: MyEvent }) {
  const { event, state, provenance, effectiveVisibility } = item;
  const tab = dateTab(event);
  const place = where(event);
  const participation = PARTICIPATION[state];
  const SourceIcon = SOURCE_ICON[provenance.source] ?? Sparkles;
  return (
    <Link to={`/events/${event.id}`} className="pd-card k-event-card">
      <div className="pd-person" style={{ alignItems: "flex-start" }}>
        <div className="pd-date" aria-hidden="true">
          <div>{tab.month}</div>
          <div>{tab.day}</div>
        </div>
        <div className="k-grow">
          <h4>{event.title}</h4>
          {place && (
            <p className="k-meta">
              <MapPin className="pd-i" aria-hidden="true" />
              {place}
            </p>
          )}
          <div className="pd-chips" style={{ marginTop: 8 }}>
            {participation && <span className="pd-badge pd-badge--brand">{participation}</span>}
            <span className="pd-pill">
              <SourceIcon className="pd-i" aria-hidden="true" />
              {SOURCE_LABEL[provenance.source] ?? provenance.source}
            </span>
            {effectiveVisibility === "confirmed_attendees" && (
              <span className="pd-badge pd-badge--privacy">
                <Eye className="pd-i" aria-hidden="true" />
                Visible to matches
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
