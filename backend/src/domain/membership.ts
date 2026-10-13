// Membership state rules from the brief's State table.
import type { MembershipState, Provenance } from "../db/schema.js";

// Safe product wording. "unknown" has none on purpose: the UI shows nothing rather than guess.
export function safeWording(state: MembershipState, eventTitle: string): string | null {
  switch (state) {
    case "host":
      return `Hosting ${eventTitle}`;
    case "invited":
      return `Invited to ${eventTitle}`;
    case "registered":
      return `Planning to attend ${eventTitle}`;
    case "attended":
      return `Attended ${eventTitle}`;
    case "unknown":
      return null;
  }
}

// Only a provider check-in record (sourceRef "checkin:<id>") from a connected provider counts as an
// authorized attendance signal. Anything else claiming "attended" is downgraded, so attendance is never inferred.
const ATTENDANCE_PROVIDERS = new Set(["luma_mcp", "mock_luma"]);

export function normalizeIncomingState(state: MembershipState, provenance: Provenance): MembershipState {
  if (state !== "attended") return state;
  const authorized = ATTENDANCE_PROVIDERS.has(provenance.source) && !!provenance.sourceRef?.startsWith("checkin:");
  return authorized ? "attended" : "registered";
}

// When two sources disagree, keep the more specific state; ties go to higher confidence.
const RANK: Record<MembershipState, number> = { unknown: 0, invited: 1, registered: 2, attended: 3, host: 4 };

export function mergeState(
  current: { state: MembershipState; provenance: Provenance } | null,
  incoming: { state: MembershipState; provenance: Provenance },
): { state: MembershipState; provenance: Provenance } {
  if (!current) return incoming;
  const dr = RANK[incoming.state] - RANK[current.state];
  if (dr > 0) return incoming;
  if (dr < 0) return current;
  return incoming.provenance.confidence >= current.provenance.confidence ? incoming : current;
}
