// Chats: Klick AI chats about one of the member's events, and direct messages with accepted Klicks.
// Klick AI only sees what the member could already see in the app, gathered and permission-checked here.
import { answerChat } from "../ai/chat.js";
import { getDb, fromFirestore } from "../db/firestore.js";
import { AiChat, AiChatMessage, COLLECTIONS, type Event, type EventMembership, type Member } from "../db/schema.js";
import { ConsentError, otherMember } from "../domain/consent.js";
import { listConnections } from "../db/repos/connections.js";
import { getEvent, getMembership, listMyMemberships, visibleAttendees } from "../db/repos/events.js";
import { getMember, publicProfile } from "../db/repos/members.js";
import { listFollowUps } from "../db/repos/memories.js";
import { listSaves } from "../db/repos/saves.js";
import { listDirectThreads, openDirectThread } from "../db/repos/dm.js";
import { listMemories } from "../db/repos/memories.js";
import { eventPeopleDetail } from "./ai.js";
import { discoverEvents, klicksGoingByEvent } from "./discover.js";

const CONFIRMED = ["registered", "host", "attended"];
const MAX_MESSAGES = 60; // per chat, to keep a chat focused and the model's context small
const chats = () => getDb().collection(COLLECTIONS.aiChats);

const PROVIDER_NAMES: Record<string, string> = {
  google_calendar: "Google Calendar",
  luma_mcp: "Luma",
  mock_luma: "Luma",
  meetup: "Meetup",
  seed: "Klick",
};
const firstName = (name: string) => name.split(/\s+/)[0] ?? name;
const shortDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

const eventFacts = (e: Event) => ({
  id: e.id,
  title: e.title,
  startsAt: e.startsAt.toISOString(),
  venue: e.venue.online ? "Online" : [e.venue.name, e.venue.city].filter(Boolean).join(", "),
  description: e.description.slice(0, 600),
  tags: e.tags,
});

const goals = (m: Member, mine: EventMembership) => ({
  name: m.displayName,
  goalForThisEvent: mine.goal,
  lookingFor: [...(m.questionnaire?.lookingFor ?? []), m.questionnaire?.lookingForDetail ?? ""].filter(Boolean),
  offering: [...(m.questionnaire?.offering ?? []), m.questionnaire?.offeringDetail ?? ""].filter(Boolean),
  topics: m.questionnaire?.topics ?? [],
  interests: m.interests,
});

// Everything Klick AI may use for this member and event, and the allow-lists its answer is checked against.
async function gather(memberId: string, eventId: string) {
  const [me, mine, event] = await Promise.all([getMember(memberId), getMembership(memberId, eventId), getEvent(eventId)]);
  if (!me || !mine || !event) throw new ConsentError("Not on this event", 404);
  const [detail, followUps, existing, saves, others, goingByEvent] = await Promise.all([
    eventPeopleDetail(memberId, mine),
    listFollowUps(memberId),
    listConnections(memberId),
    listSaves(memberId, eventId),
    discoverEvents(memberId),
    klicksGoingByEvent(memberId),
  ]);
  const sources: Array<{ key: string; label: string }> = [];

  // Klicks going: people the member already knows, with the member's own reviewed notes and open follow-ups.
  const klicks = new Map<string, string>(); // memberId -> connectionId
  const klicksGoing = detail.catchUp.map((k) => {
    klicks.set(k.profile.id, k.connectionId);
    const owed = followUps.filter((f) => f.connectionId === k.connectionId && ["open", "prompted"].includes(f.status));
    if (k.memory?.text) sources.push({ key: `memory:${k.profile.id}`, label: `Memory: ${firstName(k.profile.displayName)}, ${shortDate(k.met.at)}` });
    return {
      id: k.profile.id,
      name: k.profile.displayName,
      role: k.profile.role,
      company: k.profile.company,
      metAt: k.met.eventTitle,
      myNote: k.memory?.text ?? null,
      iOweThem: owed.map((f) => f.reason),
    };
  });
  if (klicksGoing.length) sources.unshift({ key: "klicks", label: "Your Klicks" });

  // Worth meeting: same reciprocal rule as matches. Only people who chose to be found, and only what they share.
  const reciprocal = mine.effectiveVisibility === "confirmed_attendees" && CONFIRMED.includes(mine.state);
  const exclude = new Set(existing.filter((c) => ["accepted", "pending", "blocked"].includes(c.status)).map((c) => otherMember(c, memberId)));
  const pool = reciprocal ? (await visibleAttendees(eventId, memberId)).filter((p) => !exclude.has(p.memberId)).slice(0, 30) : [];
  const savedIds = new Set(saves.map((s) => s.memberId));
  const worthMeeting = (
    await Promise.all(
      pool.map(async (p) => {
        const m = await getMember(p.memberId);
        if (!m) return null;
        const pub = publicProfile(m);
        if (savedIds.has(m.id)) sources.push({ key: `saved:${m.id}`, label: `Saved: ${m.displayName}` });
        return {
          id: m.id,
          name: m.displayName,
          role: pub.role,
          company: pub.company,
          headline: pub.headline,
          goalForThisEvent: p.goal,
          lookingFor: [...(m.questionnaire?.lookingFor ?? []), m.questionnaire?.lookingForDetail ?? ""].filter(Boolean),
          offering: [...(m.questionnaire?.offering ?? []), m.questionnaire?.offeringDetail ?? ""].filter(Boolean),
          topics: [...new Set([...(m.questionnaire?.topics ?? []), ...m.interests])],
          savedByMe: savedIds.has(m.id),
        };
      }),
    )
  ).filter((x) => !!x);

  // Other events: only ones the member's Klicks are going to and let Klicks see (Discover's rule).
  const otherEvents = await Promise.all(
    others.slice(0, 15).map(async (r) => {
      const names = await Promise.all((goingByEvent.get(r.event.id) ?? []).slice(0, 5).map(async (k) => (await getMember(k.other))?.displayName ?? ""));
      return { ...eventFacts(r.event), klicksGoing: names.filter(Boolean), savedByMe: r.saved };
    }),
  );
  if (otherEvents.length) {
    const providers = [...new Set(others.flatMap((r) => r.event.sourceRefs.map((s) => PROVIDER_NAMES[s.provider] ?? s.provider)))];
    sources.push({ key: "events", label: providers.join(", ") || "Your Klicks' events" });
  }
  const g = goals(me, mine);
  if (g.goalForThisEvent || g.lookingFor.length || g.topics.length) sources.push({ key: "goals", label: "Your goals" });

  return {
    me,
    event,
    ctx: { event: eventFacts(event), me: g, klicksGoing, worthMeeting, otherEvents, sources },
    allowed: { klicks, people: new Set(worthMeeting.map((p) => p.id)), events: new Set(otherEvents.map((e) => e.id)) },
  };
}

type Gathered = Awaited<ReturnType<typeof gather>>;

const messagesOf = (chatId: string) => chats().doc(chatId).collection("messages");

async function getOwnedChat(id: string, ownerId: string): Promise<AiChat> {
  const snap = await chats().doc(id).get();
  const chat = snap.exists ? fromFirestore<AiChat>(snap.data()!) : null;
  if (!chat || chat.ownerId !== ownerId) throw new ConsentError("Chat not found", 404);
  return chat;
}

async function loadMessages(chatId: string) {
  const snap = await messagesOf(chatId).orderBy("createdAt").get();
  return snap.docs.map((d) => fromFirestore<AiChatMessage>(d.data()));
}

// Asks Klick AI and stores both the question and the checked answer.
async function ask(chat: AiChat, question: string, g: Gathered, history: AiChatMessage[]) {
  if (history.length >= MAX_MESSAGES) throw new ConsentError("This chat is full. Start a new chat for this event.", 409);
  const out = await answerChat(question, {
    ...g.ctx,
    history: history.slice(-10).map((m) => ({ role: m.role, text: m.text })),
    language: g.me.languages[0] ?? "en",
    simpleLanguage: g.me.accessibility.simpleLanguage,
  });
  const labels = new Map(g.ctx.sources.map((s) => [s.key, s.label]));
  const now = new Date();
  const mine = AiChatMessage.parse({ id: messagesOf(chat.id).doc().id, role: "me", text: question, createdAt: now });
  const answer = AiChatMessage.parse({
    id: messagesOf(chat.id).doc().id,
    role: "ai",
    text: out.text,
    // The model can only point at people and events it was given; anything else is dropped.
    people: out.people.filter((p) => g.allowed.klicks.has(p.id) || g.allowed.people.has(p.id)).map((p) => ({ memberId: p.id, reason: p.reason })),
    eventIds: out.eventIds.filter((id) => g.allowed.events.has(id)),
    sources: [...new Set(out.sources)].filter((k) => labels.has(k)).map((k) => ({ key: k, label: labels.get(k)! })),
    suggestions: out.suggestions,
    createdAt: new Date(now.getTime() + 1),
  });
  const updated: AiChat = { ...chat, preview: out.text.slice(0, 200), messageCount: history.length + 2, updatedAt: answer.createdAt };
  await getDb().batch().set(messagesOf(chat.id).doc(mine.id), mine).set(messagesOf(chat.id).doc(answer.id), answer).set(chats().doc(chat.id), updated).commit();
  return { chat: updated, added: [mine, answer] };
}

// People and events in stored answers are re-checked on every read, so someone who hides later disappears.
async function present(memberId: string, chat: AiChat, messages: AiChatMessage[]) {
  const ids = new Set(messages.flatMap((m) => m.people.map((p) => p.memberId)));
  const eventIds = new Set(messages.flatMap((m) => m.eventIds));
  const [existing, mine, pool, others, saves] = await Promise.all([
    listConnections(memberId),
    getMembership(memberId, chat.eventId),
    ids.size ? visibleAttendees(chat.eventId, memberId) : Promise.resolve([]),
    eventIds.size ? discoverEvents(memberId) : Promise.resolve([]),
    listSaves(memberId, chat.eventId),
  ]);
  const accepted = new Map(existing.filter((c) => c.status === "accepted").map((c) => [otherMember(c, memberId), c]));
  const exclude = new Set(existing.filter((c) => ["blocked", "pending"].includes(c.status)).map((c) => otherMember(c, memberId)));
  const reciprocal = !!mine && mine.effectiveVisibility === "confirmed_attendees" && CONFIRMED.includes(mine.state);
  const visible = new Map(pool.map((p) => [p.memberId, p]));
  const people = new Map<string, unknown>();
  await Promise.all(
    [...ids].map(async (id) => {
      const m = await getMember(id);
      if (!m) return;
      const conn = accepted.get(id);
      if (conn) return void people.set(id, { kind: "klick", connectionId: conn.id, profile: publicProfile(m, true) });
      if (!reciprocal || exclude.has(id) || !visible.has(id)) return;
      const ms = visible.get(id)!;
      const tags = [...new Set([...(m.questionnaire?.topics ?? []), ...m.interests])].slice(0, 3);
      people.set(id, {
        kind: "suggested",
        profile: publicProfile(m),
        state: ms.state,
        tags,
        saved: saves.some((s) => s.memberId === id),
      });
    }),
  );
  const events = new Map(others.filter((r) => eventIds.has(r.event.id)).map((r) => [r.event.id, { event: r.event, saved: r.saved, catchUp: r.catchUp }]));
  return {
    chat,
    messages: messages.map((m) => ({
      ...m,
      people: m.people.filter((p) => people.has(p.memberId)).map((p) => ({ ...(people.get(p.memberId) as object), reason: p.reason })),
      events: m.eventIds.filter((id) => events.has(id)).map((id) => events.get(id)),
    })),
  };
}

const titleFrom = (q: string) => {
  const t = q.trim().replace(/[?.!\s]+$/, "");
  return t.length > 60 ? `${t.slice(0, 57)}...` : t;
};

export async function startAiChat(memberId: string, eventId: string, question: string) {
  const g = await gather(memberId, eventId);
  const now = new Date();
  const chat = AiChat.parse({ id: chats().doc().id, ownerId: memberId, eventId, title: titleFrom(question), preview: "", messageCount: 0, createdAt: now, updatedAt: now });
  const { chat: saved, added } = await ask(chat, question, g, []);
  return present(memberId, saved, added);
}

export async function continueAiChat(memberId: string, chatId: string, question: string) {
  const chat = await getOwnedChat(chatId, memberId);
  const g = await gather(memberId, chat.eventId);
  const history = await loadMessages(chat.id);
  const { chat: saved, added } = await ask(chat, question, g, history);
  return present(memberId, saved, [...history, ...added]);
}

export async function getAiChat(memberId: string, chatId: string) {
  const chat = await getOwnedChat(chatId, memberId);
  const event = await getEvent(chat.eventId);
  return { ...(await present(memberId, chat, await loadMessages(chat.id))), event };
}

export async function deleteAiChat(memberId: string, chatId: string) {
  const chat = await getOwnedChat(chatId, memberId);
  const msgs = await messagesOf(chat.id).listDocuments();
  const batch = getDb().batch();
  for (const d of msgs) batch.delete(d);
  batch.delete(chats().doc(chat.id));
  await batch.commit();
}

async function ownChats(memberId: string, eventId?: string) {
  let q = chats().where("ownerId", "==", memberId);
  if (eventId) q = q.where("eventId", "==", eventId);
  const snap = await q.get();
  return snap.docs.map((d) => fromFirestore<AiChat>(d.data())).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function listEventAiChats(memberId: string, eventId: string) {
  if (!(await getMembership(memberId, eventId))) throw new ConsentError("Not on this event", 404);
  return ownChats(memberId, eventId);
}

// The Chats tab: the member's Klick AI chats and their direct threads, newest first.
export async function listChats(memberId: string) {
  const [aiChats, conns, memberships] = await Promise.all([ownChats(memberId), listConnections(memberId), listMyMemberships(memberId)]);
  const titles = new Map(memberships.map((m) => [m.event.id, m.event.title]));
  const threads = await listDirectThreads(memberId, conns);
  const people = await Promise.all(
    threads.map(async (t) => {
      const m = await getMember(t.otherId);
      if (!m) return null;
      const pub = publicProfile(m, true);
      return {
        kind: "person" as const,
        id: t.thread.id,
        title: m.displayName,
        subtitle: [pub.role, pub.company].filter(Boolean).join(", "),
        preview: t.thread.last!.from === memberId ? `You: ${t.thread.last!.text}` : t.thread.last!.text,
        at: t.thread.last!.at,
        unread: t.unread,
      };
    }),
  );
  const ai = aiChats
    .filter((c) => titles.has(c.eventId))
    .map((c) => ({ kind: "ai" as const, id: c.id, title: c.title, subtitle: titles.get(c.eventId)!, eventId: c.eventId, preview: c.preview, at: c.updatedAt, unread: 0 }));
  return [...ai, ...people.filter((x) => !!x)].sort((a, b) => b!.at.getTime() - a!.at.getTime());
}

// A direct thread as one participant sees it: the other person, where you Klicked, the messages,
// and the member's own latest memory of them (owner-only, pinned at the top).
export async function directThread(memberId: string, connectionId: string) {
  const { conn, messages, canSend } = await openDirectThread(connectionId, memberId);
  const [other, event, memories, followUps] = await Promise.all([
    getMember(otherMember(conn, memberId)),
    conn.eventId ? getEvent(conn.eventId) : Promise.resolve(null),
    listMemories(memberId, conn.id),
    listFollowUps(memberId),
  ]);
  const latest = memories.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
  const owed = followUps.find((f) => f.connectionId === conn.id && ["open", "prompted"].includes(f.status)) ?? null;
  return {
    connectionId: conn.id,
    other: other ? publicProfile(other, conn.status === "accepted") : null,
    met: { eventTitle: event?.title ?? null, at: conn.respondedAt ?? conn.createdAt },
    memory: latest,
    followUp: owed,
    messages,
    canSend,
  };
}
