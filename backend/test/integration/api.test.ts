// Runs against the Firestore emulator: `npm test` starts it automatically.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "../../src/server.js";
import { setLinkedInCandidate } from "../../src/db/repos/onboarding.js";
import { setLlm } from "../../src/ai/client.js";
import { canonicalKey, importEvents, pruneSource, visibleAttendees } from "../../src/db/repos/events.js";
import { FakeLlm } from "../fakeLlm.js";

const llm = new FakeLlm();
setLlm(llm);

process.env.AUTH_MODE = "dev";
process.env.JOB_SECRET = "test-secret";
process.env.DEMO_MODE = "1";

const app = buildServer();
const as = (member: string) => ({ "x-dev-member": member });

async function call(member: string, method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: object) {
  const res = await app.inject({ method, url, headers: as(member), payload });
  return { status: res.statusCode, body: res.json() };
}

async function resetEmulator() {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  await fetch(`http://${host}/emulator/v1/projects/demo-event-networking/databases/(default)/documents`, { method: "DELETE" });
}

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Run with `npm test` so the Firestore emulator is up");
  await app.ready();
});
beforeEach(async () => {
  llm.fail = false;
  llm.responses = {
    "reconnect.draft": { whyNow: "You promised Ravi the TTS repo.", message: "Hi Ravi, great meeting you at DevFest. Here's the TTS repo I mentioned." },
  };
  await resetEmulator();
});

async function onboard(id: string, visibility: "hidden" | "confirmed_attendees" = "confirmed_attendees") {
  await call(id, "PUT", "/v1/me", { displayName: id, interests: ["accessibility"], defaultVisibility: visibility });
  await call(id, "POST", "/v1/sources/mock_luma/connect");
  const events = (await call(id, "GET", "/v1/events")).body as Array<{ event: { id: string; title: string } }>;
  return events.find((e) => e.event.title.startsWith("DevFest"))!.event.id;
}

describe("ingestion and membership", () => {
  it("imports the member's events once, dedupes across members, and uses safe wording", async () => {
    const e1 = await onboard("asha");
    const e2 = await onboard("ravi");
    expect(e1).toBe(e2); // same Luma event -> one normalized event
    await call("asha", "POST", "/v1/sources/mock_luma/connect"); // re-sync is idempotent
    type Row = { label: string; state: string; event: { title: string }; provenance: { source: string } };
    const events = (await call("ravi", "GET", "/v1/events")).body as Row[];
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.provenance.source === "mock_luma")).toBe(true);
    const wording: Record<string, string> = { host: "Hosting", registered: "Planning to attend", attended: "Attended" };
    for (const e of events) expect(e.label).toBe(`${wording[e.state]} ${e.event.title}`);
  });

  it("matching pool only contains visible, confirmed attendees, and there is no attendee list endpoint", async () => {
    const ev = await onboard("asha");
    await onboard("ravi");
    await onboard("hidden_hema", "hidden");
    const pool = await visibleAttendees(ev, "asha");
    expect(pool.map((p) => p.memberId)).toEqual(["ravi"]);
    expect((await call("asha", "GET", `/v1/events/${ev}/attendees`)).status).toBe(404);
    // Someone not on the event can't get matches for it.
    await call("outsider", "PUT", "/v1/me", { displayName: "o" });
    expect((await call("outsider", "GET", `/v1/events/${ev}/matches`)).status).toBe(404);
  });

  it("links a Calendar invite to the same Luma event through its lu.ma link, keeping Luma's details", async () => {
    const ev = await onboard("asha");
    await call("ravi", "PUT", "/v1/me", { displayName: "ravi" });
    const [calId] = await importEvents("ravi", "google_calendar", [{
      externalId: "abc123@google.com", title: "DevFest (calendar copy)",
      description: "Register: https://lu.ma/DevFest-Pune-2026 see you there", startsAt: new Date(), state: "registered",
    }]);
    expect(calId).toBe(ev);
    const page = (await call("ravi", "GET", `/v1/events/${ev}`)).body;
    expect(page.event.title).toBe("DevFest Pune 2026");
    expect(page.event.organizerName).toBe("GDG Pune");
    expect(page.event.providerGuestCount).toBe(640);
    expect(page.event.sourceRefs.map((r: { provider: string }) => r.provider).sort()).toEqual(["google_calendar", "mock_luma"]);
    expect(canonicalKey({ url: null, description: "nothing here" })).toBeNull();
  });

  it("a Calendar re-sync drops entries it no longer imports and keeps other sources", async () => {
    await onboard("asha");
    const cal = (id: string) => ({ externalId: id, title: id, description: "", startsAt: new Date(), state: "host" as const });
    const [flight, meetup] = await importEvents("asha", "google_calendar", [cal("flight@google.com"), cal("meetup@google.com")]);
    expect(await pruneSource("asha", "google_calendar", [meetup])).toBe(1);
    const ids = (await call("asha", "GET", "/v1/events")).body.map((e: { event: { id: string } }) => e.event.id);
    expect(ids).toContain(meetup);
    expect(ids).not.toContain(flight);
    expect(ids.length).toBe(3); // the meetup plus the two mock Luma events from onboarding
  });

  it("event page shows counts with a small-number floor and only my accepted connections, never a guest list", async () => {
    const ev = await onboard("asha");
    await onboard("ravi");
    let page = (await call("asha", "GET", `/v1/events/${ev}`)).body;
    expect(page.onPlatformGoing).toEqual({ count: null, label: "fewer than 3" });
    expect(page.effectiveVisibility).toBe("confirmed_attendees"); // my own setting, for the page's switch
    await call("asha", "PUT", `/v1/events/${ev}/goal`, { goal: "Meet climate founders" });
    expect((await call("asha", "GET", `/v1/events/${ev}`)).body.goal).toBe("Meet climate founders");
    await onboard("meera");
    await onboard("hidden_hema", "hidden");
    page = (await call("asha", "GET", `/v1/events/${ev}`)).body;
    expect(page.onPlatformGoing).toEqual({ count: 4, label: "4" });
    expect(page.discoverable.count).toBe(3);
    expect(page.catchUp).toEqual([]); // ravi is going but isn't asha's connection
    expect(page.alsoGoing.map((p: { id: string }) => p.id).sort()).toEqual(["meera", "ravi"]); // chose to be found
    expect(page.notShown).toBeNull(); // only one person isn't findable: too few to count
    const req = await call("ravi", "POST", "/v1/connections", { to: "asha", eventId: ev, context: "DevFest" });
    await call("asha", "POST", `/v1/connections/${req.body.id}/accept`);
    page = (await call("asha", "GET", `/v1/events/${ev}`)).body;
    expect(page.catchUp.map((c: { profile: { id: string } }) => c.profile.id)).toEqual(["ravi"]);
    expect(page.catchUp[0].met.eventTitle).toBe("DevFest Pune 2026");
    expect(page.catchUp[0].memory).toBeNull();
    expect(page.alsoGoing.map((p: { id: string }) => p.id)).toEqual(["meera"]); // ravi moved to catch up
    await call("asha", "POST", "/v1/memories", { kind: "text", text: "Talked about Pune meetups", storagePath: null, connectionId: req.body.id, eventId: ev });
    page = (await call("asha", "GET", `/v1/events/${ev}`)).body;
    expect(page.catchUp[0].memory).toMatchObject({ reviewed: true, text: "Talked about Pune meetups" }); // my own note
    const ravisView = (await call("ravi", "GET", `/v1/events/${ev}`)).body;
    expect(JSON.stringify(ravisView)).not.toContain("Pune meetups"); // memories stay with their author
    expect((await call("hidden_hema", "GET", `/v1/events/${ev}`)).body.alsoGoing).toEqual([]); // reciprocal
    expect(JSON.stringify(page)).not.toContain("hidden_hema");
    expect((await call("outsider", "GET", `/v1/events/${ev}`)).status).toBe(404);
  });

  it("events list carries a people signal: initials and counts only, reciprocal and excluding hidden members", async () => {
    const ev = await onboard("asha");
    await onboard("ravi");
    await onboard("meera");
    await onboard("hidden_hema", "hidden");
    await call("meera", "PUT", "/v1/me", { displayName: "Meera Iyer" });
    const row = async (id: string) =>
      (await call(id, "GET", "/v1/events")).body.find((e: { event: { id: string } }) => e.event.id === ev).people;
    let people = await row("asha");
    expect(people.worthMeeting.count).toBe(2); // ravi and meera, not hidden_hema
    expect(people.worthMeeting.initials).toContain("MI");
    expect(people.catchUp).toEqual({ count: 0, initials: [] });
    const req = await call("ravi", "POST", "/v1/connections", { to: "asha", eventId: ev, context: "DevFest" });
    await call("asha", "POST", `/v1/connections/${req.body.id}/accept`);
    people = await row("asha");
    expect(people.catchUp.count).toBe(1); // ravi moves from worth meeting to catch up
    expect(people.worthMeeting.count).toBe(1);
    expect(JSON.stringify(people)).not.toMatch(/ravi|meera|hema/i);
    expect((await row("hidden_hema")).worthMeeting.count).toBe(0); // hidden members see no one
  });

  it("past event: met here, wrap up, and a self-reported answer that never counts as verified", async () => {
    const ev = await onboard("asha");
    await onboard("ravi");
    const req = await call("ravi", "POST", "/v1/connections", { to: "asha", eventId: ev, context: "DevFest" });
    await call("asha", "POST", `/v1/connections/${req.body.id}/accept`);
    await call("asha", "POST", "/v1/followups", { connectionId: req.body.id, reason: "Send the deck", dueAt: new Date(Date.now() + 86400000).toISOString(), sourceMemoryId: null });
    let page = (await call("asha", "GET", `/v1/events/${ev}`)).body;
    expect(page.metHere.map((c: { profile: { id: string } }) => c.profile.id)).toEqual(["ravi"]);
    expect(page.wrapUp.followUps).toHaveLength(1);
    expect(page.wrapUp.followUps[0]).toMatchObject({ reason: "Send the deck", with: "ravi" });
    expect(page.wrapUp.toReview).toBe(0);
    expect(page.selfReport).toBeNull();
    await call("asha", "PUT", `/v1/events/${ev}/attendance`, { selfReport: "went" });
    page = (await call("asha", "GET", `/v1/events/${ev}`)).body;
    expect(page.selfReport).toBe("went");
    expect(page.state).not.toBe("attended"); // only a provider can verify attendance
    expect((await call("ravi", "GET", `/v1/events/${ev}`)).body.wrapUp.followUps).toEqual([]); // follow-ups stay with their owner
  });

  it("saving a suggestion is private, needs the same visibility as matching, and resurfaces until you reach out", async () => {
    const ev = await onboard("asha");
    await onboard("ravi");
    await onboard("hidden_hema", "hidden");
    expect((await call("asha", "PUT", `/v1/events/${ev}/saves/hidden_hema`, {})).status).toBe(404); // can't save who you can't see
    expect((await call("hidden_hema", "PUT", `/v1/events/${ev}/saves/ravi`, {})).status).toBe(403); // reciprocal
    expect((await call("asha", "PUT", `/v1/events/${ev}/saves/ravi`, { reason: "Both into accessibility" })).status).toBe(200);
    let page = (await call("asha", "GET", `/v1/events/${ev}`)).body;
    expect(page.saved).toEqual(["ravi"]);
    expect(page.stillToConnect[0]).toMatchObject({ memberId: "ravi", reason: "Both into accessibility" });
    expect(JSON.stringify((await call("ravi", "GET", `/v1/events/${ev}`)).body)).not.toContain("Both into accessibility");
    expect((await call("ravi", "GET", `/v1/events/${ev}`)).body.saved).toEqual([]); // ravi is never told
    await call("asha", "POST", "/v1/connections", { to: "ravi", eventId: ev, context: "" });
    page = (await call("asha", "GET", `/v1/events/${ev}`)).body;
    expect(page.stillToConnect).toEqual([]); // reached out, so no longer a reminder
    await call("asha", "DELETE", `/v1/events/${ev}/saves/ravi`);
    expect((await call("asha", "GET", `/v1/events/${ev}`)).body.saved).toEqual([]);
  });

  it("discover finds upcoming events only through accepted Klicks who let Klicks see them", async () => {
    await onboard("asha");
    await call("ravi", "PUT", "/v1/me", { displayName: "Ravi Menon", defaultVisibility: "connections" });
    const [future] = await importEvents("ravi", "google_calendar", [{
      externalId: "future@google.com", title: "Design Mixer", description: "", startsAt: new Date(Date.now() + 5 * 86400000), state: "registered",
    }]);
    expect((await call("asha", "GET", "/v1/discover")).body).toEqual([]); // not Klicks yet
    expect((await call("asha", "GET", `/v1/discover/${future}`)).status).toBe(404);
    const req = await call("ravi", "POST", "/v1/connections", { to: "asha", eventId: null, context: "" });
    await call("asha", "POST", `/v1/connections/${req.body.id}/accept`);
    const list = (await call("asha", "GET", "/v1/discover")).body;
    expect(list.map((r: { event: { id: string } }) => r.event.id)).toEqual([future]);
    expect(list[0].catchUp).toEqual({ count: 1, initials: ["RM"] });
    expect(list[0].worthMeeting.label).toBe("fewer than 3");
    const detail = (await call("asha", "GET", `/v1/discover/${future}`)).body;
    expect(detail.catchUp[0].profile.id).toBe("ravi");
    expect((await call("outsider", "GET", `/v1/discover/${future}`)).status).toBe(404);
    expect((await call("asha", "PUT", `/v1/events/${future}/save`)).body.saved).toBe(true);
    expect((await call("asha", "GET", "/v1/discover")).body[0].saved).toBe(true);
    await call("asha", "POST", `/v1/events/${future}/plan`);
    const mine = (await call("asha", "GET", `/v1/events/${future}`)).body;
    expect(mine.state).toBe("registered");
    expect(mine.provenance.source).toBe("manual");
    expect((await call("asha", "GET", "/v1/discover")).body).toEqual([]); // now one of yours
    await call("ravi", "PUT", `/v1/events/${future}/visibility`, { visibility: "hidden" });
    expect((await call("outsider", "POST", `/v1/events/${future}/plan`)).status).toBe(404);
  });

  it("disconnecting a source deletes the memberships it created", async () => {
    await onboard("asha");
    const res = await call("asha", "DELETE", "/v1/sources/mock_luma");
    expect(res.body.deletedMemberships).toBe(2);
    expect((await call("asha", "GET", "/v1/events")).body).toEqual([]);
    expect((await call("asha", "GET", "/v1/sources")).body).toEqual([]);
  });
});

describe("consent-aware exchange, memories and follow-ups", () => {
  it("runs the full flow with privacy enforced", async () => {
    const ev = await onboard("asha");
    await onboard("ravi");

    const req = await call("asha", "POST", "/v1/connections", { to: "ravi", eventId: ev, context: "Met at the a11y talk" });
    expect(req.status).toBe(200);
    const connId = req.body.id;
    expect((await call("asha", "POST", `/v1/connections/${connId}/accept`)).status).toBe(403); // requester can't self-accept
    expect((await call("asha", "POST", "/v1/connections", { to: "ravi", eventId: ev })).status).toBe(409); // no duplicates
    const incoming = (await call("ravi", "GET", "/v1/connections?status=pending")).body;
    expect(incoming).toHaveLength(1);
    expect(incoming[0]).toMatchObject({ incoming: true, other: { id: "asha" }, event: { id: ev }, sharedContact: {} });
    expect((await call("ravi", "POST", `/v1/connections/${connId}/accept`)).body.status).toBe("accepted");
    expect((await call("asha", "GET", "/v1/connections")).body[0]).toMatchObject({ incoming: false, other: { id: "ravi" } });

    const mem = await call("asha", "POST", "/v1/memories", { kind: "text", text: "Works on flood-alert SMS", connectionId: connId });
    expect(mem.body.aboutMemberIds).toEqual(["ravi"]);
    expect(mem.body.sharedWith).toEqual([]);
    // Ravi can't see Asha's private memory, and can't delete it.
    expect((await call("ravi", "GET", "/v1/memories")).body).toEqual([]);
    expect((await call("ravi", "DELETE", `/v1/memories/${mem.body.id}`)).status).toBe(404);
    // Explicit share only to the connection it's about.
    expect((await call("asha", "POST", `/v1/memories/${mem.body.id}/share`, { with: "someone_else" })).status).toBe(403);
    expect((await call("asha", "POST", `/v1/memories/${mem.body.id}/share`, { with: "ravi" })).body.sharedWith).toEqual(["ravi"]);

    const due = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    const fu = await call("asha", "POST", "/v1/followups", { connectionId: connId, reason: "Send TTS repo", dueAt: due });
    expect(fu.body.status).toBe("open");

    // Job is protected, and the demo fast-forward prompts the follow-up.
    expect((await app.inject({ method: "POST", url: "/jobs/reconnect", payload: {} })).statusCode).toBe(403);
    const job = await app.inject({
      method: "POST", url: "/jobs/reconnect", headers: { "x-job-secret": "test-secret" },
      payload: { now: new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString() },
    });
    expect(job.json()).toEqual({ prompted: 1, drafted: 1 });
    const prompted = ((await call("asha", "GET", "/v1/followups")).body as Array<{ status: string; draft: string; whyNow: string }>)[0];
    expect(prompted.status).toBe("prompted");
    expect(prompted.draft).toContain("TTS repo");

    // Revoking ends the connection; follow-ups can no longer be created.
    expect((await call("ravi", "POST", `/v1/connections/${connId}/revoke`)).body.status).toBe("revoked");
    expect((await call("asha", "POST", "/v1/followups", { connectionId: connId, reason: "x", dueAt: due })).status).toBe(409);
  });

  it("rejects attaching an event the other person isn't on", async () => {
    const ev = await onboard("asha");
    await call("ravi", "PUT", "/v1/me", { displayName: "ravi" });
    expect((await call("asha", "POST", "/v1/connections", { to: "ravi", eventId: ev })).status).toBe(400);
  });
});

describe("CORS", () => {
  it("lets the web app's origin call the API and no one else", async () => {
    const ok = await app.inject({ method: "OPTIONS", url: "/v1/me", headers: { origin: "http://localhost:5173", "access-control-request-method": "GET" } });
    expect(ok.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    const bad = await app.inject({ method: "OPTIONS", url: "/v1/me", headers: { origin: "https://evil.example", "access-control-request-method": "GET" } });
    expect(bad.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("Luma sign-in", () => {
  it("serves the client metadata document and rejects unknown or someone else's sign-in state", async () => {
    expect((await app.inject({ method: "GET", url: "/oauth/luma-client.json" })).statusCode).toBe(503);
    process.env.PUBLIC_API_URL = "https://api.example.com";
    const doc = (await app.inject({ method: "GET", url: "/oauth/luma-client.json" })).json();
    expect(doc.client_id).toBe("https://api.example.com/oauth/luma-client.json");
    delete process.env.PUBLIC_API_URL;
    await call("asha", "PUT", "/v1/me", { displayName: "asha" });
    const res = await call("asha", "POST", "/v1/sources/luma_mcp/callback", { code: "x", state: "not-a-real-state" });
    expect(res.status).toBe(400);
  });
});

describe("QR exchange and field-level sharing", () => {
  it("role, company and location follow the owner's before-a-Klick and after-accept choices", async () => {
    await onboard("alice");
    await onboard("bob");
    await call("alice", "PUT", "/v1/me", {
      role: "Designer", company: "Fernwood", headline: "Designer, Fernwood", location: "Pune",
      sharing: { beforeKlick: ["photo"], afterAccept: ["role_company", "location"] },
    });
    const qr = (await call("alice", "POST", "/v1/qr", {})).body;
    const before = (await call("bob", "GET", `/v1/qr/${qr.token}`)).body.profile;
    expect(before).toMatchObject({ role: "", company: "", headline: "", location: "" });
    const conn = (await call("bob", "POST", "/v1/connections", { qrToken: qr.token })).body;
    expect((await call("bob", "GET", `/v1/connections/${conn.id}`)).body.other.role).toBe("");
    await call("alice", "POST", `/v1/connections/${conn.id}/accept`, {});
    const after = (await call("bob", "GET", `/v1/connections/${conn.id}`)).body.other;
    expect(after).toMatchObject({ role: "Designer", company: "Fernwood", location: "Pune" });
  });

  it("previews without contact values, needs both approvals, then reveals only chosen fields", async () => {
    const ev = await onboard("alice");
    await onboard("bob");
    await call("alice", "PUT", "/v1/me", { contact: { email: "alice@example.com", phone: "+91 90000 00000" } });
    await call("bob", "PUT", "/v1/me", { contact: { linkedin: "linkedin.com/in/bob" } });

    const qr = (await call("alice", "POST", "/v1/qr", { eventId: ev })).body;
    const preview = await call("bob", "GET", `/v1/qr/${qr.token}`);
    expect(preview.body.profile.displayName).toBe("alice");
    expect(preview.body.availableContactFields.sort()).toEqual(["email", "phone"]);
    expect(JSON.stringify(preview.body)).not.toContain("alice@example.com");
    expect((await call("bob", "GET", "/v1/qr/not-a-real-token")).status).toBe(410);

    const req = await call("bob", "POST", "/v1/connections", {
      qrToken: qr.token, context: "Met at the community-products panel",
      requestNote: { kind: "text", text: "Bob, building a Marathi TTS" }, shareFields: ["linkedin", "email"],
    });
    expect(req.body.status).toBe("pending");
    expect(req.body.eventId).toBe(ev);
    expect(req.body.sharedFields.bob).toEqual(["linkedin"]); // email not filled in, so dropped
    // Nothing is revealed while pending.
    expect((await call("alice", "GET", `/v1/connections/${req.body.id}`)).body.sharedContact).toEqual({});

    await call("alice", "POST", `/v1/connections/${req.body.id}/accept`, { shareFields: ["email"] });
    const bobView = (await call("bob", "GET", `/v1/connections/${req.body.id}`)).body;
    expect(bobView.sharedContact).toEqual({ email: "alice@example.com" });
    expect(bobView.connection.requestNote.text).toBe("Bob, building a Marathi TTS");
    expect((await call("alice", "GET", `/v1/connections/${req.body.id}`)).body.sharedContact).toEqual({ linkedin: "linkedin.com/in/bob" });

    // Revoking hides contact details again.
    await call("alice", "POST", `/v1/connections/${req.body.id}/revoke`);
    expect((await call("bob", "GET", `/v1/connections/${req.body.id}`)).body.sharedContact).toEqual({});
    // Outsiders can't read it.
    expect((await call("mallory", "GET", `/v1/connections/${req.body.id}`)).status).toBe(404);
  });

  it("a QR names its event only when the scanner is on it too", async () => {
    const ev = await onboard("asha");
    await call("bob", "PUT", "/v1/me", { displayName: "bob" });
    const qr = (await call("asha", "POST", "/v1/qr", { eventId: ev })).body;
    expect((await call("bob", "GET", `/v1/qr/${qr.token}`)).body).toMatchObject({ eventId: null, event: null });
    expect((await call("bob", "POST", "/v1/connections", { qrToken: qr.token })).body.eventId).toBeNull();
    await onboard("ravi");
    const preview = (await call("ravi", "GET", `/v1/qr/${qr.token}`)).body;
    expect(preview.event).toMatchObject({ id: ev, title: expect.stringContaining("DevFest") });
    expect((await call("ravi", "POST", "/v1/connections", { qrToken: qr.token })).body.eventId).toBe(ev);
  });

  it("auto-accept honours the recipient's preference but shares nothing until they choose", async () => {
    await call("alice", "PUT", "/v1/me", { displayName: "alice", connectionPreference: "auto_accept", contact: { email: "a@x.com" } });
    await call("bob", "PUT", "/v1/me", { displayName: "bob" });
    const qr = (await call("alice", "POST", "/v1/qr", {})).body;
    const conn = (await call("bob", "POST", "/v1/connections", { qrToken: qr.token })).body;
    expect(conn.status).toBe("accepted");
    expect((await call("bob", "GET", `/v1/connections/${conn.id}`)).body.sharedContact).toEqual({});
    await call("alice", "PUT", `/v1/connections/${conn.id}/shared-fields`, { fields: ["email"] });
    expect((await call("bob", "GET", `/v1/connections/${conn.id}`)).body.sharedContact).toEqual({ email: "a@x.com" });
  });

  it("rejects media paths that belong to someone else", async () => {
    await call("alice", "PUT", "/v1/me", { displayName: "alice" });
    const res = await call("alice", "POST", "/v1/memories", { kind: "photo", storagePath: "members/bob/photo/1.jpg" });
    expect(res.status).toBe(403);
  });

  it("stores a per-event goal", async () => {
    const ev = await onboard("alice");
    await call("alice", "PUT", `/v1/events/${ev}/goal`, { goal: "Someone working on community-led products" });
    const rows = (await call("alice", "GET", "/v1/events")).body as Array<{ event: { id: string }; goal: string }>;
    expect(rows.find((r) => r.event.id === ev)!.goal).toBe("Someone working on community-led products");
  });
});


describe("onboarding", () => {
  it("verified email -> consent -> block -> LinkedIn -> sources -> who you want to meet -> done", async () => {
    expect((await call("diya", "PUT", "/v1/me", {})).body.onboarding.step).toBe("account");
    expect((await call("diya", "PUT", "/v1/onboarding/step", { step: "consent" })).body.onboarding.step).toBe("consent");
    expect((await call("diya", "PUT", "/v1/onboarding/step", { step: "block" })).body.onboarding.step).toBe("block");
    expect((await call("diya", "PUT", "/v1/onboarding/step", { step: "identity" })).body.onboarding.step).toBe("identity");
    const cand = await setLinkedInCandidate("diya", { sub: "li-123", name: "Diya S", email: "diya@execora.in", email_verified: true }, "diya@execora.in");
    expect(cand.emailMatchesAccount).toBe(true);
    // Not applied until confirmed.
    expect((await call("diya", "GET", "/v1/me")).body.linkedin).toBeNull();
    const confirmed = (await call("diya", "POST", "/v1/onboarding/linkedin/confirm", { isMe: true })).body;
    expect(confirmed.linkedin.name).toBe("Diya S");
    expect(confirmed.displayName).toBe("Diya S");
    expect(confirmed.onboarding.step).toBe("integrations");
    await call("diya", "POST", "/v1/sources/mock_luma/connect");
    expect((await call("diya", "POST", "/v1/onboarding/integrations/done")).body.onboarding.step).toBe("questionnaire");
    const done = (await call("diya", "PUT", "/v1/onboarding/questionnaire", {
      lookingFor: ["co-founder", "backend engineer to hire"], offering: ["product strategy"], topics: ["community"],
    })).body;
    expect(done.onboarding.step).toBe("done");
    expect(done.onboarding.completedAt).toBeTruthy();
    expect(done.questionnaire.lookingFor).toContain("co-founder");
  });

  it("moves between steps, back and forward, and refuses unknown steps", async () => {
    await call("diya", "PUT", "/v1/me", {});
    expect((await call("diya", "PUT", "/v1/onboarding/step", { step: "integrations" })).body.onboarding.step).toBe("integrations");
    expect((await call("diya", "PUT", "/v1/onboarding/step", { step: "consent" })).body.onboarding.step).toBe("consent");
    expect((await call("diya", "PUT", "/v1/onboarding/step", { step: "admin" })).status).toBe(400);
  });

  it("block and sharing defaults are saved, and contact details can't be shown before a Klick", async () => {
    const me = (await call("diya", "PUT", "/v1/me", { block: { color: "green", studs: 6 }, location: "Pune, India (IST)" })).body;
    expect(me.block).toEqual({ color: "green", studs: 6 });
    expect(me.sharing.beforeKlick).toEqual(["photo", "role_company"]);
    expect(me.discoverability).toBe("ask");
    expect((await call("diya", "PUT", "/v1/me", { block: { color: "gold", studs: 6 } })).status).toBe(400);
    expect((await call("diya", "PUT", "/v1/me", { sharing: { beforeKlick: ["email"], afterAccept: [] } })).status).toBe(400);
    const saved = (await call("diya", "PUT", "/v1/me", { sharing: { beforeKlick: ["location"], afterAccept: ["role_company", "email"] } })).body;
    expect(saved.sharing).toEqual({ beforeKlick: ["location"], afterAccept: ["role_company", "email"] });
  });

  it("LinkedIn username is saved as a private contact link without changing the step", async () => {
    await call("diya", "PUT", "/v1/me", {});
    expect((await call("diya", "PUT", "/v1/onboarding/linkedin/username", { username: "https://evil.example/x" })).status).toBe(400);
    expect((await call("diya", "PUT", "/v1/onboarding/linkedin/username", { username: "ab" })).status).toBe(400);
    const me = (await call("diya", "PUT", "/v1/onboarding/linkedin/username", { username: "Diya-Karmakar" })).body;
    expect(me.linkedinProfile).toMatchObject({ username: "diya-karmakar", url: "https://www.linkedin.com/in/diya-karmakar", source: "self_reported" });
    expect(me.contact.linkedin).toBe("https://www.linkedin.com/in/diya-karmakar"); // private until shared on a Klick
    expect(me.linkedin).toBeNull(); // typing a username is not a LinkedIn sign-in
    expect(me.onboarding.step).toBe("account");
  });

  it("LinkedIn sign-in uses a server-made, one-use state and an allowed return address", async () => {
    await call("diya", "PUT", "/v1/me", {});
    process.env.WEB_URL = "https://klick.example";
    delete process.env.LINKEDIN_CLIENT_ID;
    const cb = encodeURIComponent("https://klick.example/connect/linkedin/callback");
    expect((await call("diya", "GET", `/v1/onboarding/linkedin/start?redirectUri=${cb}`)).status).toBe(503);
    process.env.LINKEDIN_CLIENT_ID = "li-client";
    const bad = encodeURIComponent("https://evil.example/cb");
    expect((await call("diya", "GET", `/v1/onboarding/linkedin/start?redirectUri=${bad}`)).status).toBe(400);
    const start = (await call("diya", "GET", `/v1/onboarding/linkedin/start?redirectUri=${cb}`)).body;
    expect(new URL(start.url).searchParams.get("state")).toBe(start.state);
    expect(new URL(start.url).searchParams.get("redirect_uri")).toBe("https://klick.example/connect/linkedin/callback");
    // Someone else can't finish Diya's sign-in, and a made-up state is refused.
    await call("eve", "PUT", "/v1/me", {});
    expect((await call("eve", "POST", "/v1/onboarding/linkedin/callback", { code: "c", state: start.state })).status).toBe(400);
    expect((await call("diya", "POST", "/v1/onboarding/linkedin/callback", { code: "c", state: "made-up-state" })).status).toBe(400);
    delete process.env.LINKEDIN_CLIENT_ID;
    delete process.env.WEB_URL;
  });

  it("saying 'not me' discards the LinkedIn data", async () => {
    await call("diya", "PUT", "/v1/me", { displayName: "Diya" });
    await setLinkedInCandidate("diya", { sub: "li-999", name: "Someone Else" }, "diya@execora.in");
    const res = (await call("diya", "POST", "/v1/onboarding/linkedin/confirm", { isMe: false })).body;
    expect(res.linkedin).toBeNull();
    expect(res.linkedinCandidate).toBeNull();
    expect(res.displayName).toBe("Diya");
  });
});

describe("Gemini features through the API", () => {
  async function pair() {
    const ev = await onboard("alice");
    await onboard("bob");
    await onboard("carol");
    await call("alice", "PUT", `/v1/events/${ev}/goal`, { goal: "someone working on community-led products" });
    await call("bob", "PUT", "/v1/onboarding/questionnaire", { offering: ["community-led product strategy"], topics: ["community"] });
    return ev;
  }

  it("matches only eligible people, and requires the seeker to be discoverable", async () => {
    const ev = await pair();
    await call("carol", "PUT", `/v1/events/${ev}/visibility`, { visibility: "hidden" });
    llm.responses["match.rank"] = { matches: [{ memberId: "bob", score: 88, reason: "Bob offers community-led product strategy.", starter: "Hi Bob!", evidence: [{ mine: "community-led products", theirs: "community-led product strategy" }] }] };
    const res = (await call("alice", "GET", `/v1/events/${ev}/matches`)).body;
    expect(res.ai).toBe(true);
    expect(res.matches.map((m: { memberId: string }) => m.memberId)).toEqual(["bob"]);
    expect(res.matches[0].profile.displayName).toBe("bob");
    // Opted-out Carol never reaches the model.
    expect(JSON.stringify(llm.calls.at(-1)!.parts)).not.toContain("carol");
    // A hidden seeker can't browse others.
    expect((await call("carol", "GET", `/v1/events/${ev}/matches`)).status).toBe(403);
  });

  it("falls back to overlap ranking when Gemini fails", async () => {
    const ev = await pair();
    llm.fail = true;
    const res = await call("alice", "GET", `/v1/events/${ev}/matches`);
    expect(res.status).toBe(200);
    expect(res.body.ai).toBe(false);
  });

  it("turns a note into a reviewable memory with a dated follow-up suggestion", async () => {
    const ev = await pair();
    const conn = (await call("alice", "POST", "/v1/connections", { to: "bob", eventId: ev })).body;
    await call("bob", "POST", `/v1/connections/${conn.id}/accept`);
    const mem = (await call("alice", "POST", "/v1/memories", { kind: "text", text: "Bob runs community-led growth at a Pune startup. I said I'd send the prototype next week.", connectionId: conn.id })).body;
    llm.responses["memory.extract"] = {
      transcript: null, summary: "Met Bob, who runs community-led growth.", topics: ["community-led growth"],
      promises: [{ text: "Send the prototype", owner: "me" }], followUp: { reason: "Send the prototype", dueInDays: 7 },
    };
    const analyzed = (await call("alice", "POST", `/v1/memories/${mem.id}/analyze`)).body;
    expect(analyzed.reviewState).toBe("draft");
    expect(analyzed.aiDraft).toBe("Met Bob, who runs community-led growth.");
    expect(analyzed.text).toContain("next week"); // original note kept
    const due = new Date(analyzed.ai.suggestedFollowUp.dueAt).getTime();
    expect(Math.round((due - Date.now()) / 86400000)).toBe(7);
    // Bob can't analyse Alice's memory.
    expect((await call("bob", "POST", `/v1/memories/${mem.id}/analyze`)).status).toBe(404);

    // Malformed model output is a recoverable error, and the memory is untouched.
    llm.responses["memory.extract"] = { summary: 42 };
    const bad = await call("alice", "POST", `/v1/memories/${mem.id}/analyze`);
    expect(bad.status).toBe(503);
    expect(bad.body.retryable).toBe(true);
  });
});

describe("chats", () => {
  it("Klick AI only sees and shows people the member may see, and answers are re-checked when read", async () => {
    const ev = await onboard("asha");
    await onboard("ravi");
    await onboard("meera");
    await onboard("hidden_hema", "hidden");
    const req = await call("ravi", "POST", "/v1/connections", { to: "asha", eventId: ev, context: "" });
    await call("asha", "POST", `/v1/connections/${req.body.id}/accept`);
    const mem = await call("asha", "POST", "/v1/memories", { kind: "text", text: "draft", connectionId: req.body.id });
    await call("asha", "POST", `/v1/memories/${mem.body.id}/review`, { text: "Owes me the flood-alert deck" });
    await call("asha", "PUT", `/v1/events/${ev}/goal`, { goal: "Meet climate founders" });
    llm.responses["chat.answer"] = {
      text: "Ravi is going. Meera is worth meeting.",
      people: [{ id: "ravi", reason: "Your Klick" }, { id: "meera", reason: "Accessibility" }, { id: "hidden_hema", reason: "x" }, { id: "nobody", reason: "x" }],
      eventIds: ["made-up-event"],
      sources: ["klicks", "memory:ravi", "goals", "invented"],
      suggestions: ["Draft an intro to Meera"],
    };

    const started = await call("asha", "POST", `/v1/events/${ev}/ai-chats`, { text: "Who from my Klicks is going?" });
    expect(started.status).toBe(200);
    const chatId = started.body.chat.id;
    expect(started.body.chat.title).toBe("Who from my Klicks is going");
    const answer = started.body.messages[1];
    expect(answer.role).toBe("ai");
    expect(answer.people.map((p: { kind: string; profile: { id: string } }) => [p.kind, p.profile.id])).toEqual([["klick", "ravi"], ["suggested", "meera"]]);
    expect(answer.people[0].connectionId).toBe(req.body.id);
    expect(answer.events).toEqual([]);
    expect(answer.sources.map((s: { key: string }) => s.key)).toEqual(["klicks", "memory:ravi", "goals"]);

    // What the model saw: Asha's own reviewed note and goal, never the hidden member.
    const sent = JSON.stringify(llm.calls.at(-1)!.parts);
    expect(sent).toContain("Owes me the flood-alert deck");
    expect(sent).toContain("Meet climate founders");
    expect(sent).not.toContain("hidden_hema");

    // Owner only.
    expect((await call("ravi", "GET", `/v1/ai-chats/${chatId}`)).status).toBe(404);
    expect((await call("ravi", "POST", `/v1/ai-chats/${chatId}/messages`, { text: "hi" })).status).toBe(404);
    expect((await call("outsider", "POST", `/v1/events/${ev}/ai-chats`, { text: "hi" })).status).toBe(404);
    expect((await call("ravi", "GET", `/v1/events/${ev}/ai-chats`)).body).toEqual([]);

    // A follow-up carries the earlier turns; Meera hiding later removes her from stored answers.
    const next = await call("asha", "POST", `/v1/ai-chats/${chatId}/messages`, { text: "Draft an intro to Meera" });
    expect(next.body.messages).toHaveLength(4);
    expect(JSON.stringify(llm.calls.at(-1)!.parts)).toContain("Ravi is going.");
    await call("meera", "PUT", `/v1/events/${ev}/visibility`, { visibility: "hidden" });
    const reread = (await call("asha", "GET", `/v1/ai-chats/${chatId}`)).body;
    expect(reread.messages[1].people.map((p: { profile: { id: string } }) => p.profile.id)).toEqual(["ravi"]);
    expect(reread.event.id).toBe(ev);

    const list = (await call("asha", "GET", "/v1/chats")).body;
    expect(list).toMatchObject([{ kind: "ai", id: chatId, subtitle: "DevFest Pune 2026", unread: 0 }]);
    expect((await call("asha", "GET", `/v1/events/${ev}/ai-chats`)).body).toHaveLength(1);
    expect((await call("ravi", "DELETE", `/v1/ai-chats/${chatId}`)).status).toBe(404);
    expect((await call("asha", "DELETE", `/v1/ai-chats/${chatId}`)).status).toBe(200);
    expect((await call("asha", "GET", "/v1/chats")).body).toEqual([]);
  });

  it("an AI failure keeps the chat as it was and says it can be retried", async () => {
    const ev = await onboard("asha");
    llm.fail = true;
    const res = await call("asha", "POST", `/v1/events/${ev}/ai-chats`, { text: "Who should I meet?" });
    expect(res.status).toBe(503);
    expect(res.body.retryable).toBe(true);
    expect((await call("asha", "GET", "/v1/chats")).body).toEqual([]);
  });

  it("direct messages only flow while a Klick is accepted, with unread counts and the owner's own memory", async () => {
    const ev = await onboard("asha");
    await onboard("ravi");
    const req = await call("asha", "POST", "/v1/connections", { to: "ravi", eventId: ev, context: "" });
    const id = req.body.id;
    expect((await call("asha", "POST", `/v1/dm/${id}`, { text: "hi" })).status).toBe(409); // still pending
    await call("ravi", "POST", `/v1/connections/${id}/accept`);
    await call("asha", "POST", "/v1/memories", { kind: "text", text: "Asha's private note", connectionId: id });
    expect((await call("asha", "POST", `/v1/dm/${id}`, { text: "Great meeting you!" })).status).toBe(200);
    expect((await call("outsider", "POST", `/v1/dm/${id}`, { text: "x" })).status).toBe(404);
    expect((await call("outsider", "GET", `/v1/dm/${id}`)).status).toBe(404);
    expect((await call("asha", "POST", `/v1/dm/${id}`, { text: "   " })).status).toBe(400);

    let ravis = (await call("ravi", "GET", "/v1/chats")).body;
    expect(ravis).toMatchObject([{ kind: "person", id, title: "asha", preview: "Great meeting you!", unread: 1 }]);
    const thread = (await call("ravi", "GET", `/v1/dm/${id}`)).body;
    expect(thread.messages.map((m: { text: string }) => m.text)).toEqual(["Great meeting you!"]);
    expect(thread.memory).toBeNull(); // Asha's memory stays hers
    expect(thread.met.eventTitle).toBe("DevFest Pune 2026");
    expect(thread.canSend).toBe(true);
    ravis = (await call("ravi", "GET", "/v1/chats")).body;
    expect(ravis[0].unread).toBe(0);
    expect((await call("asha", "GET", `/v1/dm/${id}`)).body.memory.text).toBe("Asha's private note");
    expect((await call("asha", "GET", "/v1/chats")).body[0].preview).toBe("You: Great meeting you!");

    await call("ravi", "POST", `/v1/connections/${id}/revoke`);
    expect((await call("asha", "POST", `/v1/dm/${id}`, { text: "still there?" })).status).toBe(409);
    expect((await call("asha", "GET", `/v1/dm/${id}`)).body.canSend).toBe(false);
    expect((await call("asha", "GET", "/v1/chats")).body).toEqual([]);
  });
});

describe("demo data", () => {
  it("Demo events gives a member Klicks going, a request, a private note, messages and a Discover event", async () => {
    process.env.DEMO_DATA = "1";
    try {
      await call("visitor", "PUT", "/v1/me", { displayName: "Visitor" });
      expect((await call("visitor", "POST", "/v1/sources/mock_luma/connect")).body.imported).toBe(2);
      await call("visitor", "POST", "/v1/sources/mock_luma/connect"); // twice is harmless
      const klicks = (await call("visitor", "GET", "/v1/connections?status=accepted")).body;
      expect(klicks.map((k: { other: { id: string } }) => k.other.id).sort()).toEqual(["demo-meera", "demo-ravi", "demo-sana"]);
      expect((await call("visitor", "GET", "/v1/connections?status=pending")).body).toHaveLength(1);
      const chats = (await call("visitor", "GET", "/v1/chats")).body;
      expect(chats.map((c: { title: string; unread: number }) => [c.title, c.unread])).toEqual(expect.arrayContaining([["Meera Iyer", 2], ["Ravi Patil", 1]]));
      expect((await call("visitor", "GET", "/v1/memories")).body).toHaveLength(1);
      expect((await call("visitor", "GET", "/v1/followups")).body).toHaveLength(1);
      const discover = (await call("visitor", "GET", "/v1/discover")).body;
      expect(discover.map((d: { event: { title: string } }) => d.event.title)).toContain("Women in Cloud Pune: Build with Gemini");
      const devfest = (await call("visitor", "GET", "/v1/events")).body.find((e: { event: { title: string } }) => e.event.title.startsWith("DevFest"));
      const page = (await call("visitor", "GET", `/v1/events/${devfest.event.id}`)).body;
      expect(page.catchUp.map((c: { profile: { id: string } }) => c.profile.id).sort()).toEqual(["demo-meera", "demo-ravi", "demo-sana"]);
      expect(page.effectiveVisibility).toBe("hidden"); // the visitor's own choice stays theirs
      // The hidden sample member never shows up anywhere.
      await call("visitor", "PUT", `/v1/events/${devfest.event.id}/visibility`, { visibility: "confirmed_attendees" });
      const after = (await call("visitor", "GET", `/v1/events/${devfest.event.id}`)).body;
      expect(after.alsoGoing.map((p: { id: string }) => p.id)).not.toContain("demo-dev");
      expect(after.alsoGoing.length).toBeGreaterThan(5);
    } finally {
      delete process.env.DEMO_DATA;
    }
  }, 60000);
});
