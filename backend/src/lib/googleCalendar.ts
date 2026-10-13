// Google Calendar connector (scope: calendar.events.readonly).
// The browser obtains a short-lived access token through Firebase Google sign-in and sends it once per sync.
// We use it immediately and never store it, so there is no refresh token to protect.
// Only the member's own participation is read; the attendee list is never stored (rule R1).
import type { ImportedEvent } from "../db/repos/events.js";
import type { MembershipState } from "../db/schema.js";

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";

interface GCalAttendee { self?: boolean; responseStatus?: string; organizer?: boolean; resource?: boolean }
export interface GCalEvent {
  id: string;
  eventType?: string; // "default", or "fromGmail" (flights, trains, bookings), "outOfOffice", "focusTime", ...
  iCalUID?: string;
  status?: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  location?: string;
  hangoutLink?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string };
  organizer?: { self?: boolean; email?: string };
  attendees?: GCalAttendee[];
}

// Map the member's own Calendar status to a membership state, keeping the raw value.
// Calendar can say organizer / invited / accepted / tentative, never "attended".
export function mapParticipation(ev: GCalEvent): { state: MembershipState; rawState: string } | null {
  if (ev.organizer?.self) return { state: "host", rawState: "organizer" };
  const me = ev.attendees?.find((a) => a.self);
  if (!me) return { state: "unknown", rawState: "no_self_attendee" };
  switch (me.responseStatus) {
    case "accepted":
      return { state: "registered", rawState: "accepted" };
    case "tentative":
      return { state: "invited", rawState: "tentative" };
    case "needsAction":
      return { state: "invited", rawState: "needsAction" };
    case "declined":
      return null; // not going: don't import
    default:
      return { state: "unknown", rawState: me.responseStatus ?? "none" };
  }
}

// Pages that host real events. A calendar entry linking to one counts even if nobody else is invited.
const EVENT_LINK =
  /(lu\.ma|luma\.com|meetup\.com|eventbrite\.|gdg\.community\.dev|konfhub\.com|commudle\.com|townscript\.com|allevents\.in|devpost\.com|hasgeek\.com)\//i;

// A calendar is mostly not events: flights and trains Gmail adds, reminders, focus time.
// Keep only ordinary entries that involve other people or link to an event page.
export function looksLikeEvent(ev: GCalEvent): boolean {
  if (ev.eventType && ev.eventType !== "default") return false;
  const others = (ev.attendees ?? []).filter((a) => !a.self && !a.resource);
  if (others.length > 0 || !ev.organizer?.self) return true;
  return EVENT_LINK.test(`${ev.description ?? ""} ${ev.location ?? ""}`);
}

export function toImportedEvent(ev: GCalEvent): ImportedEvent | null {
  if (ev.status === "cancelled") return null;
  if (!looksLikeEvent(ev)) return null;
  const startRaw = ev.start?.dateTime ?? ev.start?.date;
  if (!startRaw) return null;
  const p = mapParticipation(ev);
  if (!p) return null;
  const endRaw = ev.end?.dateTime ?? ev.end?.date;
  return {
    // iCalUID is shared by every attendee's copy of the same event: a strong identifier for overlap.
    externalId: ev.iCalUID ?? ev.id,
    title: ev.summary ?? "(untitled event)",
    description: (ev.description ?? "").slice(0, 2000),
    startsAt: new Date(startRaw),
    endsAt: endRaw ? new Date(endRaw) : null,
    timezone: ev.start?.timeZone ?? null,
    venue: { name: ev.location ?? null, city: null, online: !ev.location && !!ev.hangoutLink },
    url: ev.htmlLink ?? null,
    state: p.state,
    rawState: p.rawState,
    confidence: p.state === "unknown" ? 0.3 : 0.95,
  };
}

export async function fetchCalendarEvents(accessToken: string, now = new Date()): Promise<ImportedEvent[]> {
  const params = new URLSearchParams({
    timeMin: new Date(now.getTime() - 30 * 86400000).toISOString(),
    timeMax: new Date(now.getTime() + 90 * 86400000).toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
    eventTypes: "default",
  });
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401 || res.status === 403) throw new Error("calendar_auth");
  if (!res.ok) throw new Error(`calendar_http_${res.status}`);
  const body = (await res.json()) as { items?: GCalEvent[] };
  return (body.items ?? []).map(toImportedEvent).filter((e): e is ImportedEvent => e !== null);
}
