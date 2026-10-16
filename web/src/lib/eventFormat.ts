import type { KlickEvent, MembershipState } from "./api";

// Participation wording from the checklist. "Attended" only reaches us when a provider verified it.
export const PARTICIPATION: Record<MembershipState, string | null> = {
  host: "Hosting",
  invited: "Invited",
  registered: "Planning to attend",
  attended: "Attended",
  unknown: null,
};

// Only confirmed members can be discoverable or matched (R2); "invited" and "unknown" never are.
export const canBeMatched = (state: MembershipState) => state === "host" || state === "registered" || state === "attended";

export const SOURCE_LABEL: Record<string, string> = {
  google_calendar: "Google Calendar",
  luma_mcp: "Luma",
  mock_luma: "Demo",
  seed: "Demo",
  meetup: "Meetup",
};

const zone = (e: KlickEvent) => e.timezone ?? undefined;

export function dateTab(e: KlickEvent) {
  const d = new Date(e.startsAt);
  return {
    month: d.toLocaleString("en-IN", { month: "short", timeZone: zone(e) }).toUpperCase(),
    day: d.toLocaleString("en-IN", { day: "numeric", timeZone: zone(e) }),
  };
}

export function when(e: KlickEvent) {
  const opts: Intl.DateTimeFormatOptions = { timeZone: zone(e) };
  const start = new Date(e.startsAt);
  const day = start.toLocaleDateString("en-IN", { ...opts, weekday: "short", day: "numeric", month: "short" });
  const time = (d: Date) => d.toLocaleTimeString("en-IN", { ...opts, hour: "numeric", minute: "2-digit" });
  return e.endsAt ? `${day}, ${time(start)} to ${time(new Date(e.endsAt))}` : `${day}, ${time(start)}`;
}

// "Thu, 22 Oct · 6:30 pm", the list card's date line.
export function dateLine(e: KlickEvent) {
  const opts: Intl.DateTimeFormatOptions = { timeZone: zone(e) };
  const d = new Date(e.startsAt);
  const day = d.toLocaleDateString("en-IN", { ...opts, weekday: "short", day: "numeric", month: "short" });
  return `${day} · ${d.toLocaleTimeString("en-IN", { ...opts, hour: "numeric", minute: "2-digit" })}`;
}

export function where(e: KlickEvent) {
  if (e.venue.online && !e.venue.name) return "Online";
  return [e.venue.name, e.venue.city].filter(Boolean).join(", ") || null;
}

export const isPast = (e: KlickEvent) => new Date(e.endsAt ?? e.startsAt).getTime() < Date.now();
