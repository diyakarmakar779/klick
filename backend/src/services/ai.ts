// Joins the Gemini features to the data layer. Permission checks happen here, deterministically,
// before any data reaches the model.
import { MODEL } from "../ai/client.js";
import { rankMatches, type MatchFacts } from "../ai/match.js";
import { extractMemory, PROMPT_VERSION as MEMORY_PROMPT } from "../ai/memory.js";
import { draftReconnection } from "../ai/reconnect.js";
import { ConsentError, otherMember } from "../domain/consent.js";
import type { EventMembership, FollowUp, Member } from "../db/schema.js";
import { getDb, fromFirestore } from "../db/firestore.js";
import { COLLECTIONS, type Event } from "../db/schema.js";
import { getMember, publicProfile } from "../db/repos/members.js";
import { getMembership, visibleAttendees } from "../db/repos/events.js";
import { getConnectionFor, listConnections } from "../db/repos/connections.js";
import { listSaves, savePerson } from "../db/repos/saves.js";
import { getOwnedFollowUp, getOwnedMemory, listFollowUps, listMemories, saveFollowUp, saveMemory } from "../db/repos/memories.js";

const DAY = 86400000;

async function getEvent(id: string): Promise<Event | null> {
  const snap = await getDb().collection(COLLECTIONS.events).doc(id).get();
  return snap.exists ? fromFirestore<Event>(snap.data()!) : null;
}

function facts(m: Member, membership: EventMembership | null): MatchFacts {
  return {
    memberId: m.id,
    name: m.displayName,
    headline: m.headline,
    role: m.role,
    company: m.company,
    interests: m.interests,
    eventGoal: membership?.goal ?? null,
    lookingFor: [...(m.questionnaire?.lookingFor ?? []), m.questionnaire?.lookingForDetail ?? ""].filter(Boolean),
    offering: [...(m.questionnaire?.offering ?? []), m.questionnaire?.offeringDetail ?? ""].filter(Boolean),
    topics: m.questionnaire?.topics ?? [],
  };
}

export async function suggestMatches(memberId: string, eventId: string) {
  const [me, mine, event] = await Promise.all([getMember(memberId), getMembership(memberId, eventId), getEvent(eventId)]);
  if (!me || !mine || !event) throw new ConsentError("Not on this event", 404);
  // Discovery is reciprocal: you only see others if you are discoverable for this event too.
  if (mine.effectiveVisibility !== "confirmed_attendees" || !["registered", "host", "attended"].includes(mine.state)) {
    throw new ConsentError("Turn on discoverability for this event to see matches", 403);
  }
  const existing = await listConnections(memberId);
  const exclude = new Set(
    existing.filter((c) => ["accepted", "pending", "blocked"].includes(c.status)).map((c) => otherMember(c, memberId)),
  );
  const pool = (await visibleAttendees(eventId, memberId)).filter((p) => !exclude.has(p.memberId));
  const people = await Promise.all(pool.map(async (p) => ({ m: await getMember(p.memberId), ms: p })));
  const candidates = people.filter((x) => x.m).map((x) => facts(x.m!, x.ms));
  const { matches, ai } = await rankMatches(facts(me, mine), event.title, candidates);
  const profiles = new Map(people.filter((x) => x.m).map((x) => [x.m!.id, publicProfile(x.m!)]));
  return { ai, matches: matches.map((m) => ({ ...m, profile: profiles.get(m.memberId) })) };
}

const CONFIRMED = ["registered", "host", "attended"];
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

// People signal for the events list: counts and initials only, never names or profiles.
// Catch up is the member's own accepted Klicks going. Worth meeting follows the same reciprocal rule as
// matches: only when the member is confirmed and discoverable here, and only among others who chose to be found.
export async function eventPeopleSummary(memberId: string, memberships: EventMembership[]) {
  const existing = await listConnections(memberId);
  const accepted = existing.filter((c) => c.status === "accepted").map((c) => otherMember(c, memberId));
  const exclude = new Set(
    existing.filter((c) => ["accepted", "pending", "blocked"].includes(c.status)).map((c) => otherMember(c, memberId)),
  );
  const names = new Map<string, string>();
  const nameOf = async (id: string) => {
    if (!names.has(id)) names.set(id, initials((await getMember(id))?.displayName ?? ""));
    return names.get(id)!;
  };
  const signal = async (ids: string[]) => ({ count: ids.length, initials: await Promise.all(ids.slice(0, 3).map(nameOf)) });

  return Promise.all(
    memberships.map(async (mine) => {
      const theirs = await Promise.all(accepted.map((id) => getMembership(id, mine.eventId)));
      const catchUp = accepted.filter((_, i) => {
        const m = theirs[i];
        return !!m && CONFIRMED.includes(m.state) && m.effectiveVisibility !== "hidden";
      });
      const reciprocal = mine.effectiveVisibility === "confirmed_attendees" && CONFIRMED.includes(mine.state);
      const worth = reciprocal
        ? (await visibleAttendees(mine.eventId, memberId)).map((p) => p.memberId).filter((id) => !exclude.has(id))
        : [];
      return { eventId: mine.eventId, worthMeeting: await signal(worth), catchUp: await signal(catchUp) };
    }),
  );
}

// Who's going, for the event page. Catch up: the member's accepted Klicks going. Met here: Klicks made at this
// event. Each comes with the member's own latest memory of them (private to the member). Also going: names and
// roles of others who chose to be found, shown only under the same reciprocal rule as matches. Everyone else is a
// floored count, never a name. Wrap up: the member's own unreviewed memories and open follow-ups from this event.
export async function eventPeopleDetail(memberId: string, mine: EventMembership) {
  const existing = await listConnections(memberId);
  const accepted = existing.filter((c) => c.status === "accepted");
  const exclude = new Set(
    existing.filter((c) => ["accepted", "pending", "blocked"].includes(c.status)).map((c) => otherMember(c, memberId)),
  );
  const theirs = await Promise.all(accepted.map((c) => getMembership(otherMember(c, memberId), mine.eventId)));
  const going = accepted.filter((_, i) => {
    const m = theirs[i];
    return !!m && CONFIRMED.includes(m.state) && m.effectiveVisibility !== "hidden";
  });
  const metHere = accepted.filter((c) => c.eventId === mine.eventId);
  const [myMemories, myFollowUps] = await Promise.all([listMemories(memberId), listFollowUps(memberId)]);
  const rows = async (conns: typeof accepted) =>
    (
      await Promise.all(
        conns.map(async (c) => {
          const other = await getMember(otherMember(c, memberId));
          if (!other) return null;
          const latest = myMemories
            .filter((m) => m.connectionId === c.id)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
          const metAt = c.eventId ? await getEvent(c.eventId) : null;
          return {
            connectionId: c.id,
            profile: publicProfile(other),
            memory: latest
              ? { kind: latest.kind, reviewed: latest.reviewState === "reviewed", text: latest.reviewState === "reviewed" ? latest.text : null }
              : null,
            met: { eventTitle: metAt?.title ?? null, at: c.createdAt },
          };
        }),
      )
    ).filter((x) => !!x);

  const reciprocal = mine.effectiveVisibility === "confirmed_attendees" && CONFIRMED.includes(mine.state);
  const pool = reciprocal ? (await visibleAttendees(mine.eventId, memberId)).filter((p) => !exclude.has(p.memberId)) : [];
  const alsoGoing = (await Promise.all(pool.slice(0, 50).map((p) => getMember(p.memberId))))
    .filter((m) => !!m)
    .map((m) => ({ id: m!.id, displayName: m!.displayName, role: m!.role, company: m!.company, headline: m!.headline }));

  const hereIds = new Set(metHere.map((c) => c.id));
  const firstNames = new Map(
    (await Promise.all(metHere.map(async (c) => [c.id, (await getMember(otherMember(c, memberId)))?.displayName ?? ""] as const))),
  );
  const wrapUp = {
    toReview: myMemories.filter((m) => m.reviewState === "draft" && (m.eventId === mine.eventId || (m.connectionId && hereIds.has(m.connectionId)))).length,
    followUps: myFollowUps
      .filter((f) => hereIds.has(f.connectionId) && ["open", "prompted"].includes(f.status))
      .map((f) => ({ id: f.id, connectionId: f.connectionId, reason: f.reason, dueAt: f.dueAt, with: firstNames.get(f.connectionId) ?? "" })),
  };
  // Saved people: ids for the page's Save buttons, and after the event the ones you never sent a request to,
  // as long as they still let people at this event find them.
  const saves = await listSaves(memberId, mine.eventId);
  const contacted = new Set(existing.map((c) => otherMember(c, memberId)));
  const stillToConnect = (
    await Promise.all(
      saves
        .filter((s) => !contacted.has(s.memberId))
        .map(async (s) => {
          const [m, ms] = await Promise.all([getMember(s.memberId), getMembership(s.memberId, mine.eventId)]);
          if (!m || ms?.effectiveVisibility !== "confirmed_attendees") return null;
          return { memberId: m.id, reason: s.reason ?? "", starter: "", source: "overlap" as const, profile: publicProfile(m) };
        }),
    )
  ).filter((x) => !!x);
  return {
    catchUp: await rows(going),
    metHere: await rows(metHere),
    alsoGoing,
    wrapUp,
    saved: saves.map((s) => s.memberId),
    stillToConnect,
  };
}

// Save someone worth meeting. Same rule as seeing them at all: the member must be findable here too,
// and the person must be going and have chosen to be found.
export async function saveSuggestion(memberId: string, eventId: string, targetId: string, reason: string | null) {
  const mine = await getMembership(memberId, eventId);
  if (!mine) throw new ConsentError("Not on this event", 404);
  if (mine.effectiveVisibility !== "confirmed_attendees" || !CONFIRMED.includes(mine.state)) {
    throw new ConsentError("Turn on discoverability for this event to save people", 403);
  }
  const pool = await visibleAttendees(eventId, memberId);
  if (!pool.some((p) => p.memberId === targetId)) throw new ConsentError("Not someone you can see at this event", 404);
  return savePerson(memberId, eventId, targetId, reason);
}

export async function analyzeMemory(memoryId: string, ownerId: string) {
  const memory = await getOwnedMemory(memoryId, ownerId);
  const owner = await getMember(ownerId);
  const other = memory.aboutMemberIds[0] ? await getMember(memory.aboutMemberIds[0]) : null;
  const event = memory.eventId ? await getEvent(memory.eventId) : null;
  const bucket = process.env.MEDIA_BUCKET;
  const audio =
    memory.kind === "voice" && memory.storagePath && bucket
      ? { gcsUri: `gs://${bucket}/${memory.storagePath}`, mimeType: memory.storagePath.endsWith(".mp4") ? "audio/mp4" : "audio/webm" }
      : null;
  if (!memory.text && !audio) throw new ConsentError("Nothing to analyse yet", 400);

  const out = await extractMemory({
    text: memory.text,
    audio,
    otherName: other?.displayName ?? null,
    eventTitle: event?.title ?? null,
    language: owner?.languages[0] ?? "en",
  });
  const now = new Date();
  const updated = {
    ...memory,
    text: memory.text ?? out.transcript,
    aiDraft: out.summary,
    reviewState: "draft" as const,
    ai: {
      summary: out.summary,
      topics: out.topics,
      promises: out.promises,
      // Date is computed here from a day count, so the model never invents calendar dates.
      suggestedFollowUp: out.followUp ? { reason: out.followUp.reason, dueAt: new Date(now.getTime() + out.followUp.dueInDays * DAY) } : null,
      model: MODEL,
      promptVersion: MEMORY_PROMPT,
      at: now,
    },
    updatedAt: now,
  };
  await saveMemory(updated);
  return updated;
}

export async function draftFollowUp(
  followUp: FollowUp,
  opts: { language?: string; simpleLanguage?: boolean } = {},
): Promise<FollowUp> {
  const conn = await getConnectionFor(followUp.connectionId, followUp.ownerId);
  if (conn.status !== "accepted") throw new ConsentError("Connection is no longer active", 409);
  const [author, other, event, memories] = await Promise.all([
    getMember(followUp.ownerId),
    getMember(otherMember(conn, followUp.ownerId)),
    conn.eventId ? getEvent(conn.eventId) : Promise.resolve(null),
    listMemories(followUp.ownerId, conn.id),
  ]);
  const draft = await draftReconnection({
    authorName: author?.displayName ?? "",
    otherName: other?.displayName ?? "",
    eventTitle: event?.title ?? null,
    followUpReason: followUp.reason,
    // Reviewed text wins over the raw draft; only this owner's memories are used.
    memories: memories.map((m) => ({ summary: m.reviewState === "reviewed" ? m.text ?? "" : m.ai?.summary ?? m.text ?? "", createdAt: m.createdAt.toISOString() })),
    language: opts.language ?? author?.languages[0] ?? "en",
    simpleLanguage: opts.simpleLanguage ?? author?.accessibility.simpleLanguage ?? false,
  });
  const updated = { ...followUp, draft: draft.message, whyNow: draft.whyNow, updatedAt: new Date() };
  await saveFollowUp(updated);
  return updated;
}

export async function draftFollowUpById(id: string, ownerId: string, opts: { language?: string; simpleLanguage?: boolean }) {
  return draftFollowUp(await getOwnedFollowUp(id, ownerId), opts);
}
