// Source connections, events and memberships: the ingestion pipeline's write side.
import { getDb, fromFirestore } from "../firestore.js";
import {
  COLLECTIONS,
  Event,
  EventMembership,
  SourceConnection,
  type MembershipState,
  type Provenance,
} from "../schema.js";
import { mergeState, normalizeIncomingState } from "../../domain/membership.js";
import { getMember } from "./members.js";

const db = () => getDb();

// What every connector returns: the member's own events only (rule R1).
export interface ImportedEvent {
  externalId: string;
  title: string;
  description?: string;
  startsAt: Date;
  endsAt?: Date | null;
  timezone?: string | null;
  venue?: { name?: string | null; city?: string | null; online?: boolean };
  url?: string | null;
  state: MembershipState;
  stateRef?: string; // e.g. "checkin:<id>" when the provider reports a check-in
  rawState?: string; // provider's own status, stored verbatim (Calendar: needsAction/accepted/tentative/declined)
  confidence?: number;
  category?: string | null;
  tags?: string[];
  coverImageUrl?: string | null;
  organizerName?: string | null;
  guestCount?: number | null; // the provider's own public "N going", when it shows one
}

// Sources that describe an event best win when two sources disagree on its details.
const DETAIL_RANK: Record<string, number> = { luma_mcp: 3, mock_luma: 3, meetup: 2, google_calendar: 1, seed: 0 };

// Find a Luma link anywhere in the item (a Calendar invite for a Luma event carries it in the description
// or location), so the same event seen through Calendar and Luma becomes one record.
export function canonicalKey(item: Pick<ImportedEvent, "url" | "description" | "venue">): string | null {
  const text = [item.url, item.description, item.venue?.name].filter(Boolean).join(" ");
  const m = text.match(/https?:\/\/(?:www\.)?(?:lu\.ma|luma\.com)\/(?:event\/)?([A-Za-z0-9_-]+)/i);
  return m ? `luma:${m[1].toLowerCase()}` : null;
}

export async function createSourceConnection(
  memberId: string,
  provider: SourceConnection["provider"],
  scopes: string[],
  tokenRef: string | null,
): Promise<SourceConnection> {
  const ref = db().collection(COLLECTIONS.sourceConnections).doc(`${memberId}__${provider}`);
  const now = new Date();
  const conn = SourceConnection.parse({
    id: ref.id,
    memberId,
    provider,
    scopes,
    tokenRef,
    syncState: "pending",
    lastSyncAt: null,
    lastError: null,
    consentedAt: now,
    createdAt: now,
  });
  await ref.set(conn);
  return conn;
}

export async function listSourceConnections(memberId: string): Promise<SourceConnection[]> {
  const snap = await db().collection(COLLECTIONS.sourceConnections).where("memberId", "==", memberId).get();
  return snap.docs.map((d) => fromFirestore<SourceConnection>(d.data()));
}

// Upsert imported events and the member's membership in each. Returns event ids.
export async function importEvents(
  memberId: string,
  provider: SourceConnection["provider"],
  items: ImportedEvent[],
): Promise<string[]> {
  const member = await getMember(memberId);
  if (!member) throw new Error("Member not found");
  const now = new Date();
  const ids: string[] = [];

  for (const item of items) {
    const eventId = await db().runTransaction(async (tx) => {
      const refKey = `${provider}__${item.externalId}`;
      const refDoc = db().collection(COLLECTIONS.eventSourceRefs).doc(refKey);
      const refSnap = await tx.get(refDoc);
      const key = canonicalKey(item);
      const keyDoc = key ? db().collection(COLLECTIONS.eventSourceRefs).doc(`key__${key.replace(":", "_")}`) : null;
      const keySnap = keyDoc ? await tx.get(keyDoc) : null;
      // One record per real event: same provider id first, then the shared Luma link, else a new event.
      const existingId = refSnap.exists ? refSnap.get("eventId") : keySnap?.exists ? keySnap.get("eventId") : null;
      const eventRef = existingId
        ? db().collection(COLLECTIONS.events).doc(existingId)
        : db().collection(COLLECTIONS.events).doc();
      const eventSnap = await tx.get(eventRef);

      const membershipRef = db().collection(COLLECTIONS.eventMemberships).doc(`${memberId}__${eventRef.id}`);
      const membershipSnap = await tx.get(membershipRef);

      const prior = eventSnap.exists ? fromFirestore<Event>(eventSnap.data()!) : null;
      // If a better-described source already filled this event, keep its details and only fill gaps.
      const priorRank = Math.max(-1, ...(prior?.sourceRefs ?? []).map((r) => DETAIL_RANK[r.provider] ?? 0));
      const incomingWins = !prior || (DETAIL_RANK[provider] ?? 0) >= priorRank;
      const pick = <T>(incoming: T | null | undefined, old: T | null | undefined): T | null =>
        incomingWins ? (incoming ?? old ?? null) : (old ?? incoming ?? null);
      const event = Event.parse({
        id: eventRef.id,
        title: pick(item.title, prior?.title),
        description: pick(item.description || null, prior?.description || null) ?? "",
        startsAt: pick(item.startsAt, prior?.startsAt),
        endsAt: pick(item.endsAt, prior?.endsAt),
        timezone: pick(item.timezone, prior?.timezone),
        venue: {
          name: pick(item.venue?.name, prior?.venue.name),
          city: pick(item.venue?.city, prior?.venue.city),
          online: incomingWins ? (item.venue?.online ?? false) : (prior?.venue.online ?? false),
        },
        url: pick(item.url, prior?.url),
        category: pick(item.category, prior?.category),
        tags: [...new Set([...(prior?.tags ?? []), ...(item.tags ?? [])])],
        coverImageUrl: pick(item.coverImageUrl, prior?.coverImageUrl),
        organizerName: pick(item.organizerName, prior?.organizerName),
        providerGuestCount: pick(item.guestCount, prior?.providerGuestCount),
        canonicalKey: prior?.canonicalKey ?? key,
        sourceRefs: prior?.sourceRefs.some((r) => r.provider === provider && r.externalId === item.externalId)
          ? prior.sourceRefs
          : [...(prior?.sourceRefs ?? []), { provider, externalId: item.externalId, url: item.url ?? null }],
        createdAt: prior?.createdAt ?? now,
        updatedAt: now,
      });

      const provenance: Provenance = {
        source: provider,
        sourceRef: item.stateRef ?? item.externalId,
        capturedAt: now,
        confidence: item.confidence ?? 0.9,
        rawState: item.rawState,
      };
      const incoming = { state: normalizeIncomingState(item.state, provenance), provenance };
      const current = membershipSnap.exists ? fromFirestore<EventMembership>(membershipSnap.data()!) : null;
      const merged = mergeState(current, incoming);
      const visibility = current?.visibility ?? null;
      const membership = EventMembership.parse({
        id: membershipRef.id,
        memberId,
        eventId: eventRef.id,
        state: merged.state,
        provenance: merged.provenance,
        visibility,
        effectiveVisibility: visibility ?? member.defaultVisibility,
        goal: current?.goal ?? null,
        updatedAt: now,
      });

      tx.set(refDoc, { eventId: eventRef.id, provider, externalId: item.externalId });
      if (keyDoc && !keySnap?.exists) tx.set(keyDoc, { eventId: eventRef.id, key });
      tx.set(eventRef, event);
      tx.set(membershipRef, membership);
      return eventRef.id;
    });
    ids.push(eventId);
  }

  await db()
    .collection(COLLECTIONS.sourceConnections)
    .doc(`${memberId}__${provider}`)
    .set({ syncState: "ok", lastSyncAt: now, lastError: null }, { merge: true });
  return ids;
}

export async function listMyMemberships(memberId: string) {
  const snap = await db().collection(COLLECTIONS.eventMemberships).where("memberId", "==", memberId).get();
  const memberships = snap.docs.map((d) => fromFirestore<EventMembership>(d.data()));
  const events = await Promise.all(
    memberships.map((m) => db().collection(COLLECTIONS.events).doc(m.eventId).get()),
  );
  return memberships.map((m, i) => ({ membership: m, event: fromFirestore<Event>(events[i].data()!) }));
}

export async function getEvent(eventId: string): Promise<Event | null> {
  const snap = await db().collection(COLLECTIONS.events).doc(eventId).get();
  return snap.exists ? fromFirestore<Event>(snap.data()!) : null;
}

export async function getMembership(memberId: string, eventId: string): Promise<EventMembership | null> {
  const snap = await db().collection(COLLECTIONS.eventMemberships).doc(`${memberId}__${eventId}`).get();
  return snap.exists ? fromFirestore<EventMembership>(snap.data()!) : null;
}

export async function setEventVisibility(
  memberId: string,
  eventId: string,
  visibility: EventMembership["visibility"],
): Promise<EventMembership> {
  const current = await getMembership(memberId, eventId);
  if (!current) throw new Error("Not a member of this event");
  const member = await getMember(memberId);
  const updated = {
    ...current,
    visibility,
    effectiveVisibility: visibility ?? member!.defaultVisibility,
    updatedAt: new Date(),
  };
  await db().collection(COLLECTIONS.eventMemberships).doc(current.id).set(updated);
  return updated;
}

export async function setEventGoal(memberId: string, eventId: string, goal: string | null): Promise<EventMembership> {
  const current = await getMembership(memberId, eventId);
  if (!current) throw new Error("Not a member of this event");
  const updated = { ...current, goal, updatedAt: new Date() };
  await db().collection(COLLECTIONS.eventMemberships).doc(current.id).set(updated);
  return updated;
}

// Matching pool for an event (rule R2): other members who are confirmed for it and chose to be visible.
// Only "registered", "host" and "attended" count as confirmed; "invited" and "unknown" never appear.
export async function visibleAttendees(eventId: string, excludeMemberId: string): Promise<EventMembership[]> {
  const snap = await db()
    .collection(COLLECTIONS.eventMemberships)
    .where("eventId", "==", eventId)
    .where("effectiveVisibility", "==", "confirmed_attendees")
    .where("state", "in", ["registered", "host", "attended"])
    .get();
  return snap.docs.map((d) => fromFirestore<EventMembership>(d.data())).filter((m) => m.memberId !== excludeMemberId);
}

// Disconnect = delete (rule R6): remove the connection and every membership whose provenance came from it.
// Events themselves stay if another member's source still references them.
export async function disconnectSource(memberId: string, provider: SourceConnection["provider"]): Promise<number> {
  const memberships = await db()
    .collection(COLLECTIONS.eventMemberships)
    .where("memberId", "==", memberId)
    .where("provenance.source", "==", provider)
    .get();
  const batch = db().batch();
  memberships.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(db().collection(COLLECTIONS.sourceConnections).doc(`${memberId}__${provider}`));
  await batch.commit();
  return memberships.size;
}

const CONFIRMED = ["registered", "host", "attended"];
export const MIN_COUNT = 3; // below this, show "fewer than 3" so a count can't single someone out

// Event page numbers: counts plus the member's own accepted connections who are going. Never a guest list.
export async function eventStats(eventId: string, memberId: string) {
  const memberships = db().collection(COLLECTIONS.eventMemberships).where("eventId", "==", eventId);
  const [going, discoverable] = await Promise.all([
    memberships.where("state", "in", CONFIRMED).count().get(),
    memberships.where("effectiveVisibility", "==", "confirmed_attendees").where("state", "in", CONFIRMED).count().get(),
  ]);
  const show = (n: number) => ({
    count: n >= MIN_COUNT ? n : null,
    label: n >= MIN_COUNT ? String(n) : `fewer than ${MIN_COUNT}`,
  });

  const conns = await db()
    .collection(COLLECTIONS.connections)
    .where("memberIds", "array-contains", memberId)
    .where("status", "==", "accepted")
    .get();
  const otherIds = [...new Set(conns.docs.map((d) => (d.get("memberIds") as string[]).find((id) => id !== memberId)!))];
  const theirs = await Promise.all(otherIds.map((id) => getMembership(id, eventId)));
  const connectionsGoing = otherIds.filter((_, i) => {
    const m = theirs[i];
    return !!m && CONFIRMED.includes(m.state) && m.effectiveVisibility !== "hidden";
  });
  return { onPlatformGoing: show(going.data().count), discoverable: show(discoverable.data().count), connectionsGoing };
}
