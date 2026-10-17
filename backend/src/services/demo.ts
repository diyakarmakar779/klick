// Demo data, only when DEMO_DATA=1. "Demo events" puts the member among sample people at sample events, so
// every feature has something to show: Klicks going to an upcoming event, a past event you met them at, a
// request waiting, a private note and a follow-up, messages, and an event found through Discover.
// The member's own privacy choices are left alone: whether they're findable at an event stays their call.
import { DEMO_PEOPLE } from "../lib/demoPeople.js";
import { mockLumaEvents } from "../lib/mockLuma.js";
import { getDb } from "../db/firestore.js";
import { COLLECTIONS } from "../db/schema.js";
import { connectionId } from "../domain/consent.js";
import { upsertMember } from "../db/repos/members.js";
import { createSourceConnection, importEvents, setEventGoal } from "../db/repos/events.js";
import { saveQuestionnaire } from "../db/repos/onboarding.js";
import { actOnConnection, requestConnection } from "../db/repos/connections.js";
import { createFollowUp, createMemory, listMemories } from "../db/repos/memories.js";
import { sendDirectMessage } from "../db/repos/dm.js";

const DAY = 86400000;
const slug = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, "-");

// Creates or refreshes the sample members. Their events are re-imported each time, so dates stay relative to now.
export async function ensureDemoPeople(now = new Date()) {
  for (const p of DEMO_PEOPLE) {
    await upsertMember(p.id, {
      displayName: p.name,
      headline: `${p.role}${p.company ? ` at ${p.company}` : ""}`,
      role: p.role,
      company: p.company,
      location: p.location,
      interests: p.interests,
      defaultVisibility: p.visibility,
      discoverability: p.visibility === "hidden" ? "never" : "events",
      accessibility: { simpleLanguage: false, readAloud: false, prefersTextFirst: false, quietSpaces: false, ...p.accessibility },
      contact: { email: `${slug(p.name)}@example.com`, linkedin: `https://www.linkedin.com/in/demo-${slug(p.name)}` },
    });
    await saveQuestionnaire(p.id, { ...p.questionnaire, meetingStyle: "either" });
    await createSourceConnection(p.id, "mock_luma", ["events:read:self"], null);
    const [devfest] = await importEvents(p.id, "mock_luma", mockLumaEvents(p.id, now));
    if (p.devfestGoal) await setEventGoal(p.id, devfest!, p.devfestGoal);
  }
}

// Klicks the member already has with sample people, met at the past meetup.
const KLICKS = [
  { id: "demo-meera", context: "Talked about user interviews with no budget" },
  { id: "demo-ravi", context: "Flood-alert SMS and Hindi voice" },
  { id: "demo-sana", context: "Women in Cloud speaker slots" },
];

async function klick(from: string, to: string, eventId: string | null, context: string, accept: boolean) {
  const id = connectionId(from, to, eventId);
  if ((await getDb().collection(COLLECTIONS.connections).doc(id).get()).exists) return id;
  await requestConnection(from, to, { eventId, context, requestNote: null, shareFields: ["email", "linkedin"] });
  if (accept) await actOnConnection(id, to, "accept", []);
  return id;
}

// Refreshing all sample members takes a few seconds, so it runs at most twice a day.
async function refreshDemoPeople(now: Date) {
  const ref = getDb().collection(COLLECTIONS.demoState).doc("people");
  const last = (await ref.get()).get("refreshedAt")?.toDate?.() as Date | undefined;
  if (last && now.getTime() - last.getTime() < DAY / 2) return;
  await ensureDemoPeople(now);
  await ref.set({ refreshedAt: now });
}

export async function loadDemoFor(memberId: string) {
  const now = new Date();
  await refreshDemoPeople(now);
  await createSourceConnection(memberId, "mock_luma", ["events:read:self"], null);
  const [devfest, meetup] = await importEvents(memberId, "mock_luma", mockLumaEvents(memberId, now));

  const conns = [];
  for (const k of KLICKS) conns.push(await klick(k.id, memberId, meetup!, k.context, true));
  await klick("demo-kabir", memberId, devfest!, "Saw you're going to DevFest. Would love to compare notes on voice agents.", false);

  // A private note the member "wrote" about Meera, clearly marked as a sample, and the follow-up it suggests.
  const [meera, ravi] = conns;
  if ((await listMemories(memberId, meera)).length === 0) {
      const memory = await createMemory(memberId, {
        kind: "text",
        text: "Sample note: runs onboarding research at Fernwood. We talked about user interviews with no budget, and she offered to share her interview script. I said I'd send her our onboarding teardown.",
        storagePath: null,
        connectionId: meera!,
        eventId: meetup!,
        source: "demo",
      });
      await createFollowUp(memberId, { connectionId: meera!, reason: "Send Meera the onboarding teardown", dueAt: new Date(now.getTime() + 2 * DAY), sourceMemoryId: memory.id });
      await sendDirectMessage(meera!, "demo-meera", "Hey! Great meeting you at the climate meetup.");
      await sendDirectMessage(meera!, "demo-meera", "Here's the interview script I mentioned. Are you going to DevFest?");
      await sendDirectMessage(ravi!, "demo-ravi", "Thanks for the TTS pointers. See you at DevFest?");
  }
  return { events: 2, klicks: KLICKS.length, requests: 1 };
}
