// Discover: upcoming events the member isn't part of yet, found only through their own accepted Klicks.
// An event shows up only when at least one Klick is going and lets their Klicks see it (not hidden).
// Never a catalogue, never a guest list: Klicks are named (the member knows them), everyone else is a floored count.
import { getDb, fromFirestore } from "../db/firestore.js";
import { COLLECTIONS, EventMembership } from "../db/schema.js";
import { ConsentError, otherMember } from "../domain/consent.js";
import { listConnections } from "../db/repos/connections.js";
import { getEvent, getMembership, MIN_COUNT } from "../db/repos/events.js";
import { getMember, publicProfile } from "../db/repos/members.js";
import { listMemories } from "../db/repos/memories.js";

const db = () => getDb();
const CONFIRMED = ["registered", "host", "attended"];

const floored = (n: number) => ({ count: n >= MIN_COUNT ? n : null, label: n >= MIN_COUNT ? String(n) : `fewer than ${MIN_COUNT}` });
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

// Klicks who are going to each upcoming event, keyed by event id.
export async function klicksGoingByEvent(memberId: string) {
  const accepted = (await listConnections(memberId, "accepted")).map((c) => ({ conn: c, other: otherMember(c, memberId) }));
  const byEvent = new Map<string, typeof accepted>();
  await Promise.all(
    accepted.map(async (a) => {
      const snap = await db().collection(COLLECTIONS.eventMemberships).where("memberId", "==", a.other).get();
      for (const d of snap.docs) {
        const m = fromFirestore<EventMembership>(d.data());
        if (!CONFIRMED.includes(m.state) || m.effectiveVisibility === "hidden") continue;
        byEvent.set(m.eventId, [...(byEvent.get(m.eventId) ?? []), a]);
      }
    }),
  );
  return byEvent;
}

async function discoverableCount(eventId: string, exclude: Set<string>) {
  const snap = await db()
    .collection(COLLECTIONS.eventMemberships)
    .where("eventId", "==", eventId)
    .where("effectiveVisibility", "==", "confirmed_attendees")
    .where("state", "in", CONFIRMED)
    .get();
  return snap.docs.filter((d) => !exclude.has(d.get("memberId"))).length;
}

const savedId = (ownerId: string, eventId: string) => `${ownerId}__${eventId}`;

export async function discoverEvents(memberId: string) {
  const [byEvent, mine, savedSnap] = await Promise.all([
    klicksGoingByEvent(memberId),
    db().collection(COLLECTIONS.eventMemberships).where("memberId", "==", memberId).get(),
    db().collection(COLLECTIONS.savedEvents).where("ownerId", "==", memberId).get(),
  ]);
  const myEvents = new Set(mine.docs.map((d) => d.get("eventId") as string));
  const saved = new Set(savedSnap.docs.map((d) => d.get("eventId") as string));
  const now = Date.now();
  const rows = await Promise.all(
    [...byEvent.entries()]
      .filter(([eventId]) => !myEvents.has(eventId))
      .map(async ([eventId, klicks]) => {
        const event = await getEvent(eventId);
        if (!event || new Date(event.endsAt ?? event.startsAt).getTime() < now) return null;
        const klickIds = new Set(klicks.map((k) => k.other));
        const names = await Promise.all(klicks.slice(0, 3).map(async (k) => initials((await getMember(k.other))?.displayName ?? "")));
        const worth = await discoverableCount(eventId, new Set([memberId, ...klickIds]));
        return {
          event,
          saved: saved.has(eventId),
          catchUp: { count: klicks.length, initials: names },
          worthMeeting: floored(worth), // locked until the member plans to attend
        };
      }),
  );
  return rows
    .filter((r) => !!r)
    .sort((a, b) => new Date(a!.event.startsAt).getTime() - new Date(b!.event.startsAt).getTime());
}

// Discover detail for an event the member isn't on: only reachable through a Klick going.
export async function discoverEvent(memberId: string, eventId: string) {
  const event = await getEvent(eventId);
  if (!event) throw new ConsentError("Not found", 404);
  const klicks = (await klicksGoingByEvent(memberId)).get(eventId) ?? [];
  if (klicks.length === 0) throw new ConsentError("Not found", 404);
  const klickIds = new Set(klicks.map((k) => k.other));
  const [memories, worth, going, savedSnap] = await Promise.all([
    listMemories(memberId),
    discoverableCount(eventId, new Set([memberId, ...klickIds])),
    db().collection(COLLECTIONS.eventMemberships).where("eventId", "==", eventId).where("state", "in", CONFIRMED).count().get(),
    db().collection(COLLECTIONS.savedEvents).doc(savedId(memberId, eventId)).get(),
  ]);
  const catchUp = (
    await Promise.all(
      klicks.map(async ({ conn, other }) => {
        const m = await getMember(other);
        if (!m) return null;
        const latest = memories
          .filter((x) => x.connectionId === conn.id)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
        const metAt = conn.eventId ? await getEvent(conn.eventId) : null;
        return {
          connectionId: conn.id,
          profile: publicProfile(m, true),
          memory: latest
            ? { kind: latest.kind, reviewed: latest.reviewState === "reviewed", text: latest.reviewState === "reviewed" ? latest.text : null }
            : null,
          met: { eventTitle: metAt?.title ?? null, at: conn.createdAt },
        };
      }),
    )
  ).filter((x) => !!x);
  const others = Math.max(0, going.data().count - klicks.length);
  return {
    event,
    saved: savedSnap.exists,
    catchUp,
    worthMeeting: floored(worth),
    othersGoing: floored(others),
  };
}

// "Plan to attend": the member's own declaration. It doesn't register them with the organiser.
export async function planToAttend(memberId: string, eventId: string) {
  await discoverEvent(memberId, eventId); // same gate: only events found through a Klick
  if (await getMembership(memberId, eventId)) throw new ConsentError("Already in your events", 409);
  const member = await getMember(memberId);
  if (!member) throw new ConsentError("Member not found", 404);
  const now = new Date();
  const membership = EventMembership.parse({
    id: `${memberId}__${eventId}`,
    memberId,
    eventId,
    state: "registered",
    provenance: { source: "manual", capturedAt: now, confidence: 1 },
    visibility: null,
    effectiveVisibility: member.defaultVisibility,
    goal: null,
    updatedAt: now,
  });
  await db().collection(COLLECTIONS.eventMemberships).doc(membership.id).set(membership);
  return membership;
}

export async function setEventSaved(memberId: string, eventId: string, on: boolean) {
  const ref = db().collection(COLLECTIONS.savedEvents).doc(savedId(memberId, eventId));
  if (!on) return void (await ref.delete());
  await discoverEvent(memberId, eventId);
  await ref.set({ id: ref.id, ownerId: memberId, eventId, createdAt: new Date() });
}
