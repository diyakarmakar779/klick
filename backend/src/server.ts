import Fastify from "fastify";
import cors from "@fastify/cors";
import { z, ZodError } from "zod";
import { requireMember } from "./lib/auth.js";
import { ConsentError } from "./domain/consent.js";
import { safeWording } from "./domain/membership.js";
import { ContactField, Provider, Visibility } from "./db/schema.js";
import { getMember, MemberInput, ownProfile, publicProfile, upsertMember } from "./db/repos/members.js";
import {
  createSourceConnection,
  disconnectSource,
  pruneSource,
  eventStats,
  MIN_COUNT,
  getEvent,
  getMembership,
  importEvents,
  listMyMemberships,
  listSourceConnections,
  setEventGoal,
  setSelfReport,
  setEventVisibility,
  visibleAttendees,
} from "./db/repos/events.js";
import {
  actOnConnection,
  connectionView,
  listConnectionCards,
  listConnections,
  requestConnection,
  updateSharedFields,
} from "./db/repos/connections.js";
import { createQrToken, previewQr, resolveQrToken, sharedEvent } from "./db/repos/qr.js";
import { ownsPath, signedUploadUrl } from "./lib/storage.js";
import { authorizeUrl, exchangeCode } from "./lib/linkedin.js";
import { searchLinkedInProfiles, type ProfileMatch } from "./lib/profileSearch.js";
import {
  chooseLinkedInProfile,
  confirmLinkedIn,
  finishIntegrations,
  saveQuestionnaire,
  setLinkedInCandidate,
  skipIdentity,
} from "./db/repos/onboarding.js";
import { Questionnaire } from "./db/schema.js";
import {
  createFollowUp,
  createMemory,
  deleteMemory,
  listFollowUps,
  listMemories,
  promptDueFollowUps,
  reviewMemory,
  setFollowUpStatus,
  shareMemory,
} from "./db/repos/memories.js";
import { mockLumaEvents } from "./lib/mockLuma.js";
import { unsavePerson } from "./db/repos/saves.js";
import { discoverEvent, discoverEvents, planToAttend, setEventSaved } from "./services/discover.js";
import { AiError } from "./ai/client.js";
import { analyzeMemory, draftFollowUp, draftFollowUpById, eventPeopleDetail, eventPeopleSummary, saveSuggestion, suggestMatches } from "./services/ai.js";
import { CALENDAR_SCOPE, fetchCalendarEvents } from "./lib/googleCalendar.js";
import { clientMetadataDocument, fetchLumaEvents, finishLumaAuth, startLumaAuth } from "./lib/lumaMcp.js";
import { newState, saveOAuthState, takeOAuthState } from "./db/repos/oauthStates.js";

// Short-lived "Is this you?" search results per member, so revisiting onboarding doesn't search again.
const profileMatchCache = new Map<string, { at: number; matches: ProfileMatch[] }>();

export function buildServer() {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) return reply.code(400).send({ error: "Invalid input", issues: err.issues });
    if (err instanceof ConsentError) return reply.code(err.statusCode).send({ error: err.message });
    // Recoverable for the UI: show "try again" and keep the user's data as it was.
    if (err instanceof AiError) return reply.code(503).send({ error: "AI is unavailable right now", retryable: true });
    app.log.error(err);
    return reply.code(500).send({ error: "Internal error" });
  });

  // The web app (Firebase Hosting, or Vite in dev) calls this API from another origin.
  const origins = [process.env.WEB_URL, "http://localhost:5173"].filter((o): o is string => !!o);
  if (process.env.GOOGLE_CLOUD_PROJECT) origins.push(`https://${process.env.GOOGLE_CLOUD_PROJECT}.firebaseapp.com`);
  app.register(cors, { origin: origins, methods: ["GET", "POST", "PUT", "DELETE"] });

  // Not /healthz: Cloud Run reserves paths ending in "z".
  app.get("/health", async () => ({ ok: true }));

  // Public: Luma fetches this to identify hey-os (OAuth Client ID Metadata Document; Luma has no client registration).
  app.get("/oauth/luma-client.json", async (_req, reply) => {
    try {
      return clientMetadataDocument();
    } catch {
      return reply.code(503).send({ error: "Luma is not configured" });
    }
  });

  // Everything under /v1 needs a signed-in member.
  app.register(
    async (api) => {
      api.addHook("preHandler", requireMember);

      // ---- Member
      api.get("/me", async (req, reply) => {
        const m = await getMember(req.memberId);
        if (!m) return reply.code(404).send({ error: "Profile not created" });
        return ownProfile(m);
      });
      api.put("/me", async (req) => ownProfile(await upsertMember(req.memberId, MemberInput.parse(req.body))));
      // Profiles are only reachable through a connection (matches and QR previews carry their own copy),
      // so member ids can't be used to browse people.
      api.get("/members/:id", async (req, reply) => {
        const { id } = req.params as { id: string };
        const linked = (await listConnections(req.memberId)).some(
          (c) => c.memberIds.includes(id) && ["pending", "accepted"].includes(c.status),
        );
        const m = linked ? await getMember(id) : null;
        return m ? publicProfile(m) : reply.code(404).send({ error: "Not found" });
      });

      // ---- Onboarding: LinkedIn "Is this you?" -> integrations -> questionnaire
      // The server makes the state and checks it on return, so a sign-in can't be started by another site.
      api.get("/onboarding/linkedin/start", async (req, reply) => {
        const { redirectUri } = z.object({ redirectUri: z.string().url() }).parse(req.query);
        const state = newState();
        let url;
        try {
          url = authorizeUrl(redirectUri, state);
        } catch (e) {
          const msg = (e as Error).message;
          if (msg === "linkedin_redirect_not_allowed") return reply.code(400).send({ error: "Redirect URI not allowed" });
          return reply.code(503).send({ error: "LinkedIn sign-in is not set up yet" });
        }
        await saveOAuthState(state, { memberId: req.memberId, provider: "linkedin", codeVerifier: "", redirectUri });
        return { url, state };
      });
      api.post("/onboarding/linkedin/callback", async (req, reply) => {
        const { code, state } = z.object({ code: z.string().min(1), state: z.string().min(8) }).parse(req.body);
        const { redirectUri } = await takeOAuthState(state, req.memberId, "linkedin");
        try {
          const info = await exchangeCode(code, redirectUri);
          return { candidate: await setLinkedInCandidate(req.memberId, info, req.memberEmail ?? null) };
        } catch (e) {
          return reply.code(502).send({ error: "LinkedIn sign-in failed", detail: (e as Error).message });
        }
      });
      api.post("/onboarding/linkedin/confirm", async (req) => {
        const { isMe } = z.object({ isMe: z.boolean() }).parse(req.body);
        return ownProfile(await confirmLinkedIn(req.memberId, isMe));
      });
      // "Is this you?" from a web search for the member's Google name. Cached briefly so going back and
      // forth in onboarding doesn't search again; never written to the database.
      api.get("/onboarding/linkedin/matches", async (req, reply) => {
        const m = await getMember(req.memberId);
        if (!m) return reply.code(404).send({ error: "Profile not created" });
        if (!m.displayName || m.displayName === "New member") return { matches: [] };
        const key = `${req.memberId}:${m.displayName}`;
        const hit = profileMatchCache.get(key);
        if (hit && Date.now() - hit.at < 15 * 60_000) return { matches: hit.matches };
        try {
          const matches = await searchLinkedInProfiles(m.displayName, req.memberEmail);
          profileMatchCache.set(key, { at: Date.now(), matches });
          return { matches };
        } catch (e) {
          const msg = (e as Error).message;
          if (msg === "profile_search_not_configured") return reply.code(503).send({ error: "Profile search is not set up yet" });
          if (msg === "profile_search_rate_limited") return reply.code(429).send({ error: "Too many searches, try again soon", retryable: true });
          return reply.code(502).send({ error: "Profile search failed", retryable: true });
        }
      });
      api.post("/onboarding/linkedin/choose", async (req) => {
        const pick = z.object({ url: z.string(), name: z.string().min(1), headline: z.string().default("") }).parse(req.body);
        return ownProfile(await chooseLinkedInProfile(req.memberId, pick));
      });
      api.post("/onboarding/identity/skip", async (req) => ownProfile(await skipIdentity(req.memberId)));
      api.post("/onboarding/integrations/done", async (req) => ownProfile(await finishIntegrations(req.memberId)));
      api.put("/onboarding/questionnaire", async (req) =>
        ownProfile(await saveQuestionnaire(req.memberId, Questionnaire.omit({ updatedAt: true }).parse(req.body))),
      );

      // ---- Sources. Luma: sign in on Luma, come back with a code, read my own events once over MCP, drop the token.
      api.get("/sources/luma_mcp/start", async (req, reply) => {
        const { redirectUri } = z.object({ redirectUri: z.string().url() }).parse(req.query);
        const state = newState();
        try {
          const { url, codeVerifier } = await startLumaAuth(redirectUri, state);
          await saveOAuthState(state, { memberId: req.memberId, provider: "luma_mcp", codeVerifier, redirectUri });
          return { url, state };
        } catch (e) {
          const msg = (e as Error).message;
          if (msg === "luma_redirect_not_allowed") return reply.code(400).send({ error: "Redirect URI not allowed" });
          if (msg === "luma_not_configured") return reply.code(503).send({ error: "Luma is not configured" });
          return reply.code(502).send({ error: "Luma is unavailable" });
        }
      });
      api.post("/sources/luma_mcp/callback", async (req, reply) => {
        const { code, state } = z.object({ code: z.string().min(1), state: z.string().min(8) }).parse(req.body);
        const saved = await takeOAuthState(state, req.memberId, "luma_mcp");
        let items;
        try {
          const token = await finishLumaAuth({ code, codeVerifier: saved.codeVerifier, redirectUri: saved.redirectUri });
          items = await fetchLumaEvents(token);
        } catch (e) {
          req.log.warn({ err: (e as Error).message }, "luma sync failed");
          return reply.code(502).send({ error: "Couldn't read your Luma events; try again" });
        }
        await createSourceConnection(req.memberId, "luma_mcp", ["events:read:self"], null);
        const ids = await importEvents(req.memberId, "luma_mcp", items);
        return { imported: ids.length };
      });
      api.get("/sources", async (req) =>
        (await listSourceConnections(req.memberId)).map(({ tokenRef: _t, ...s }) => s),
      );
      api.post("/sources/mock_luma/connect", async (req) => {
        await createSourceConnection(req.memberId, "mock_luma", ["events:read:self"], null);
        const ids = await importEvents(req.memberId, "mock_luma", mockLumaEvents(req.memberId));
        return { imported: ids.length };
      });
      api.post("/sources/google_calendar/sync", async (req, reply) => {
        const { accessToken } = z.object({ accessToken: z.string().min(10) }).parse(req.body);
        let items;
        try {
          items = await fetchCalendarEvents(accessToken);
        } catch (e) {
          const auth = (e as Error).message === "calendar_auth";
          return reply.code(auth ? 401 : 502).send({ error: auth ? "Calendar access expired; reconnect" : "Calendar unavailable" });
        }
        await createSourceConnection(req.memberId, "google_calendar", [CALENDAR_SCOPE], null);
        const ids = await importEvents(req.memberId, "google_calendar", items);
        const removed = await pruneSource(req.memberId, "google_calendar", ids);
        return { imported: ids.length, removed };
      });
      api.delete("/sources/:provider", async (req) => {
        const provider = Provider.parse((req.params as { provider: string }).provider);
        return { deletedMemberships: await disconnectSource(req.memberId, provider) };
      });

      // ---- Events and memberships
      api.get("/events", async (req) => {
        const mine = await listMyMemberships(req.memberId);
        const people = await eventPeopleSummary(req.memberId, mine.map((m) => m.membership));
        return mine.map(({ membership, event }, i) => ({
          event,
          state: membership.state,
          label: safeWording(membership.state, event.title),
          provenance: membership.provenance,
          visibility: membership.visibility,
          effectiveVisibility: membership.effectiveVisibility,
          goal: membership.goal,
          people: { worthMeeting: people[i].worthMeeting, catchUp: people[i].catchUp },
        }));
      });
      // Event page: details plus counts. Only for members who have this event themselves (R1); no guest list (R11).
      api.get("/events/:eventId", async (req, reply) => {
        const { eventId } = req.params as { eventId: string };
        const membership = await getMembership(req.memberId, eventId);
        if (!membership) return reply.code(404).send({ error: "Not found" });
        const event = (await getEvent(eventId))!;
        const { connectionsGoing: _ids, ...stats } = await eventStats(eventId, req.memberId);
        const [people, sources] = await Promise.all([
          eventPeopleDetail(req.memberId, membership),
          listSourceConnections(req.memberId),
        ]);
        const going = stats.onPlatformGoing.count ?? 0;
        const notShown = Math.max(0, going - (stats.discoverable.count ?? 0));
        return {
          event,
          state: membership.state,
          label: safeWording(membership.state, event.title),
          provenance: { source: membership.provenance.source },
          visibility: membership.visibility,
          effectiveVisibility: membership.effectiveVisibility,
          goal: membership.goal,
          ...stats,
          syncedAt: sources.find((c) => c.provider === membership.provenance.source)?.lastSyncAt ?? null,
          selfReport: membership.selfReport ?? null,
          catchUp: people.catchUp,
          metHere: people.metHere,
          alsoGoing: people.alsoGoing,
          wrapUp: people.wrapUp,
          saved: people.saved,
          stillToConnect: people.stillToConnect,
          // Going but not findable. Only when the totals are big enough not to single anyone out.
          notShown: going >= MIN_COUNT && notShown >= MIN_COUNT ? notShown : null,
        };
      });
      api.put("/events/:eventId/goal", async (req) => {
        const { eventId } = req.params as { eventId: string };
        const { goal } = z.object({ goal: z.string().max(280).nullable() }).parse(req.body);
        return setEventGoal(req.memberId, eventId, goal);
      });
      // ---- Discover: events found through your own Klicks, never a catalogue
      api.get("/discover", async (req) => discoverEvents(req.memberId));
      api.get("/discover/:eventId", async (req) => discoverEvent(req.memberId, (req.params as { eventId: string }).eventId));
      api.post("/events/:eventId/plan", async (req) => planToAttend(req.memberId, (req.params as { eventId: string }).eventId));
      api.put("/events/:eventId/save", async (req) => {
        await setEventSaved(req.memberId, (req.params as { eventId: string }).eventId, true);
        return { saved: true };
      });
      api.delete("/events/:eventId/save", async (req) => {
        await setEventSaved(req.memberId, (req.params as { eventId: string }).eventId, false);
        return { saved: false };
      });
      // Save someone worth meeting (private; they're never told). Unsave is always allowed.
      api.put("/events/:eventId/saves/:memberId", async (req) => {
        const { eventId, memberId } = req.params as { eventId: string; memberId: string };
        const { reason } = z.object({ reason: z.string().max(500).nullable().default(null) }).parse(req.body ?? {});
        return saveSuggestion(req.memberId, eventId, memberId, reason);
      });
      api.delete("/events/:eventId/saves/:memberId", async (req) => {
        const { eventId, memberId } = req.params as { eventId: string; memberId: string };
        await unsavePerson(req.memberId, eventId, memberId);
        return { ok: true };
      });
      // "Did you go?" on a past event: the member's own answer, kept apart from provider-verified attendance.
      api.put("/events/:eventId/attendance", async (req) => {
        const { eventId } = req.params as { eventId: string };
        const { selfReport } = z.object({ selfReport: z.enum(["went", "didnt"]).nullable() }).parse(req.body);
        return setSelfReport(req.memberId, eventId, selfReport);
      });
      api.put("/events/:eventId/visibility", async (req) => {
        const { eventId } = req.params as { eventId: string };
        const { visibility } = z.object({ visibility: Visibility.nullable() }).parse(req.body);
        return setEventVisibility(req.memberId, eventId, visibility);
      });
      // ---- Gemini matches for an event (eligibility is checked before the model sees anyone)
      api.get("/events/:eventId/matches", async (req) => suggestMatches(req.memberId, (req.params as { eventId: string }).eventId));

      // ---- QR exchange: show a code, the scanner previews, then sends a request
      api.post("/qr", async (req) => {
        const { eventId } = z.object({ eventId: z.string().nullable().default(null) }).parse(req.body ?? {});
        const t = await createQrToken(req.memberId, eventId);
        return { token: t.id, expiresAt: t.expiresAt };
      });
      api.get("/qr/:token", async (req) => previewQr((req.params as { token: string }).token, req.memberId));

      // ---- Connections
      api.post("/connections", async (req, reply) => {
        const body = z
          .object({
            to: z.string().optional(),
            qrToken: z.string().optional(),
            eventId: z.string().nullable().default(null),
            context: z.string().max(280).default(""),
            requestNote: z
              .object({
                kind: z.enum(["text", "voice", "photo"]),
                text: z.string().max(500).nullable().default(null),
                storagePath: z.string().nullable().default(null),
              })
              .nullable()
              .default(null),
            shareFields: z.array(ContactField).default([]),
          })
          .refine((b) => !!b.to !== !!b.qrToken, "Give exactly one of `to` or `qrToken`")
          .parse(req.body);
        if (!ownsPath(req.memberId, body.requestNote?.storagePath)) {
          return reply.code(403).send({ error: "Media must be your own upload" });
        }
        let to = body.to!;
        let eventId = body.eventId;
        if (body.qrToken) {
          const t = await resolveQrToken(body.qrToken);
          to = t.memberId;
          eventId = eventId ?? (t.eventId ? (await sharedEvent(t.eventId, req.memberId))?.id ?? null : null);
        }
        return requestConnection(req.memberId, to, {
          eventId,
          context: body.context,
          requestNote: body.requestNote,
          shareFields: body.shareFields,
        });
      });
      api.get("/connections/:id", async (req) => connectionView((req.params as { id: string }).id, req.memberId));
      api.put("/connections/:id/shared-fields", async (req) => {
        const { fields } = z.object({ fields: z.array(ContactField) }).parse(req.body);
        return updateSharedFields((req.params as { id: string }).id, req.memberId, fields);
      });
      api.get("/connections", async (req) => {
        const { status } = req.query as { status?: string };
        return listConnectionCards(req.memberId, status ? z.enum(["pending", "accepted", "declined", "revoked", "blocked"]).parse(status) : undefined);
      });
      api.post("/connections/:id/:action", async (req) => {
        const { id, action } = req.params as { id: string; action: string };
        const { shareFields } = z.object({ shareFields: z.array(ContactField).default([]) }).parse(req.body ?? {});
        return actOnConnection(id, req.memberId, z.enum(["accept", "decline", "revoke", "block"]).parse(action), shareFields);
      });

      // ---- Private media upload (voice note / photo): browser PUTs straight to Cloud Storage
      api.post("/uploads", async (req) => {
        const body = z
          .object({ kind: z.enum(["voice", "photo"]), contentType: z.string().regex(/^(audio|image)\/[\w.+-]+/) })
          .parse(req.body);
        return signedUploadUrl(req.memberId, body.kind, body.contentType);
      });

      // ---- Memories
      api.post("/memories", async (req) => {
        const body = z
          .object({
            kind: z.enum(["text", "voice", "photo"]),
            text: z.string().max(5000).nullable().default(null),
            storagePath: z.string().nullable().default(null),
            connectionId: z.string().nullable().default(null),
            eventId: z.string().nullable().default(null),
          })
          .parse(req.body);
        return createMemory(req.memberId, body);
      });
      api.get("/memories", async (req) => {
        const { connectionId } = req.query as { connectionId?: string };
        return listMemories(req.memberId, connectionId);
      });
      api.post("/memories/:id/analyze", async (req) => analyzeMemory((req.params as { id: string }).id, req.memberId));
      api.post("/memories/:id/review", async (req) => {
        const { text } = z.object({ text: z.string().max(5000) }).parse(req.body);
        return reviewMemory((req.params as { id: string }).id, req.memberId, text);
      });
      api.post("/memories/:id/share", async (req) => {
        const { with: withId } = z.object({ with: z.string() }).parse(req.body);
        return shareMemory((req.params as { id: string }).id, req.memberId, withId);
      });
      api.delete("/memories/:id", async (req) => {
        await deleteMemory((req.params as { id: string }).id, req.memberId);
        return { ok: true };
      });

      // ---- Follow-ups
      api.post("/followups", async (req) => {
        const body = z
          .object({ connectionId: z.string(), reason: z.string().max(500), dueAt: z.coerce.date(), sourceMemoryId: z.string().nullable().default(null) })
          .parse(req.body);
        return createFollowUp(req.memberId, body);
      });
      api.get("/followups", async (req) => listFollowUps(req.memberId));
      api.post("/followups/:id/draft", async (req) => {
        const opts = z.object({ language: z.string().max(10).optional(), simpleLanguage: z.boolean().optional() }).parse(req.body ?? {});
        return draftFollowUpById((req.params as { id: string }).id, req.memberId, opts);
      });
      api.post("/followups/:id/:status", async (req) => {
        const { id, status } = req.params as { id: string; status: string };
        return setFollowUpStatus(id, req.memberId, z.enum(["sent", "done", "dismissed"]).parse(status));
      });
    },
    { prefix: "/v1" },
  );

  // Target for Cloud Scheduler / Pub/Sub push. Guarded by a shared secret; `now` (time fast-forward) only in demo mode.
  app.post("/jobs/reconnect", async (req, reply) => {
    if (!process.env.JOB_SECRET || req.headers["x-job-secret"] !== process.env.JOB_SECRET) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const parsed = z.object({ now: z.coerce.date().optional() }).parse(req.body ?? {});
    const now = process.env.DEMO_MODE === "1" ? parsed.now : undefined;
    const due = await promptDueFollowUps(now);
    // Draft each prompted follow-up; a Gemini failure leaves it prompted without a draft (the UI offers "try again").
    const drafted = await Promise.allSettled(due.map((fu) => draftFollowUp(fu)));
    return { prompted: due.length, drafted: drafted.filter((d) => d.status === "fulfilled").length };
  });

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 8080);
  buildServer()
    .listen({ port, host: "0.0.0.0" })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
