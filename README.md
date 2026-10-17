# Klick

Klick helps people meet the right people at events they're already going to, remember who they met, and follow up afterwards.

Members connect Google Calendar and Luma, see which of their Klicks are going, get Gemini suggestions for who to meet and why, exchange contact details by QR only when both people accept, keep private memories, and get a nudge to reconnect. Built for the AI Builder Cup 2026 (Sustainability & Social Impact).

- Live app: https://hey-os-511517.web.app
- Architecture, data model and privacy rules: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- How suggestions are ranked: [`docs/RECOMMENDATIONS.md`](docs/RECOMMENDATIONS.md)

The repository and Google Cloud project keep their original names (`hey-os`, `hey-os-511517`), so those appear in URLs and config.

## How it uses Google Cloud

| Service | What Klick uses it for |
|---|---|
| Firebase Hosting | The web app (React + Vite), mobile-first |
| Firebase Authentication | Google sign-in |
| Cloud Run | The API (Node 22, Fastify, TypeScript), the only way into the data |
| Firestore | Members, events, Klicks, memories, follow-ups, chats |
| Gemini on Vertex AI | Who to meet and why, turning notes and voice into memories, follow-up drafts, and Klick AI chat about an event, all with schema-checked output |
| Cloud Storage | Private voice notes and photos, uploaded with signed URLs |
| Secret Manager, Cloud Scheduler | Secrets, and the hourly reconnection job |

## Layout

```
backend/                 Node 22 + TypeScript + Fastify, deployed to Cloud Run
  src/db/schema.ts       Zod schemas for every collection (single source of truth)
  src/db/repos/          Firestore reads and writes per collection
  src/ai/                Gemini tasks: match ranking, memory extraction, reconnection drafts, Klick AI chat
  src/services/          Permission checks before any data reaches Gemini; Discover, chats, demo data
  src/domain/            Pure rules: membership states and safe wording, the connection consent state machine
  src/lib/lumaMcp.ts     Luma connector over Luma's official MCP server (OAuth + PKCE, own events only)
  src/lib/mockLuma.ts    Luma-shaped sample events, for trying Klick without a Luma account
  src/server.ts          REST API (/v1/...)
  firestore.rules        Clients get no direct access; everything goes through the API
  scripts/seed.ts        Sample members on the sample events
  test/                  Unit tests and API tests against the Firestore emulator
web/                     React + TypeScript + Vite, deployed to Firebase Hosting
design/                  The Prod :D design system the web app is built from
infra/gcp-setup.sh       One-time Google Cloud setup and deploy
docs/                    Architecture and recommendations
.github/                 CI (backend tests on the Firestore emulator, web lint and build) and PR template
```

## Try it

Sign in with Google at https://hey-os-511517.web.app and finish onboarding. To see every feature with data in it, choose **Demo events** in the "Where your events live" step (or later from Profile, Connected accounts). It adds two sample events, three Klicks you met at a past meetup, one pending request, a private note with a follow-up, and a few messages. Sample people are clearly fictional and use `example.com` addresses.

## Run locally

Needs Node 20+ and Java 11+ (for the Firestore emulator).

```bash
cd backend
npm install
npm test                       # starts the emulator and runs the tests
npm run emulators              # terminal 1: emulator on 127.0.0.1:8081
cp .env.example .env           # terminal 2:
export $(cat .env | xargs)
npm run seed
npm run dev                    # API on http://localhost:8080
curl -H 'x-dev-member: demo-meera' localhost:8080/v1/events
```

`AUTH_MODE=dev` lets the `x-dev-member` header stand in for a Firebase login. Never set it in Cloud Run.

Web app:

```bash
cd web
cp .env.example .env.local     # fill in the Firebase web config and API URL
npm install && npm run dev
```

## Deploy to Google Cloud

```bash
gcloud auth login && gcloud auth application-default login
PROJECT_ID=your-project-id ./infra/gcp-setup.sh
cd web && npm run build && cd .. && npx -y firebase-tools deploy --only hosting
```

The script creates or reuses the project, checks billing, enables APIs, creates Firestore (asia-south1), a private media bucket, a least-privilege service account and its secrets, adds Firebase, deploys rules and indexes, deploys the API to Cloud Run and schedules the hourly reconnection job.

## Rules the code enforces

- Klick imports only your own events and never stores guest lists. Event pages show counts, floored at "fewer than 3", and only your own Klicks who are going.
- "Attended" comes only from a provider check-in record; anything else shows as "Planning to attend". Attendance is never inferred.
- Suggestions only include members who chose to be findable at that event, and only if you are findable too.
- A Klick needs the other person to accept; either side can end it or block. Contact details are shown only after both accept, and only the fields each person chose.
- Memories are private to their owner. Klick AI chats are private to their owner.
- Follow-ups and messages are never sent for you.
- Disconnecting a source deletes every event membership it created.

## API (all under `/v1`, Bearer Firebase ID token)

| Area | Endpoints |
|---|---|
| Profile and onboarding | `GET/PUT /me` · `GET /members/:id` · `PUT /onboarding/step` · `/onboarding/linkedin/*` · `POST /onboarding/identity/skip` · `POST /onboarding/integrations/done` · `PUT /onboarding/questionnaire` |
| Sources | `GET /sources` · `GET /sources/luma_mcp/start` · `POST /sources/luma_mcp/callback` · `POST /sources/google_calendar/sync` · `POST /sources/mock_luma/connect` · `DELETE /sources/:provider` |
| Events | `GET /events` · `GET /events/:id` · `PUT /events/:id/{goal,visibility,attendance}` · `GET /events/:id/matches` (Gemini) · `PUT/DELETE /events/:id/save` · `PUT/DELETE /events/:id/saves/:memberId` |
| Discover | `GET /discover` · `GET /discover/:id` · `POST /events/:id/plan` |
| Klicks | `POST /qr` · `GET /qr/:token` · `POST /connections` · `GET /connections` · `GET /connections/:id` · `PUT /connections/:id/shared-fields` · `POST /connections/:id/{accept,decline,revoke,block}` |
| Memories and follow-ups | `POST /uploads` · `POST/GET /memories` · `POST /memories/:id/{analyze,review,share}` · `DELETE /memories/:id` · `POST/GET /followups` · `POST /followups/:id/draft` (Gemini) · `POST /followups/:id/{sent,done,dismissed}` |
| Chats | `GET /chats` · `GET/POST /events/:id/ai-chats` · `GET/DELETE /ai-chats/:id` · `POST /ai-chats/:id/messages` (Gemini) · `GET/POST /dm/:connectionId` |

Outside `/v1`: `GET /health`, `GET /oauth/luma-client.json` (Luma's client id document) and `POST /jobs/reconnect` (scheduler, secret header).

## Trying the real Luma connection

Luma signs apps in with a public "client id" URL, so the API must be reachable on the internet first (deploy with `infra/gcp-setup.sh`, which sets `PUBLIC_API_URL`). Then, from `backend/`:

```bash
LUMA_CLIENT_ID=https://<your-cloud-run-url>/oauth/luma-client.json npm run luma:inspect
```

It opens Luma's sign-in, lists the tools Luma offers, and prints your own events as Klick would import them. Nothing is saved.

## Team and tools

Built by Diya and Sivasurya. Parts of the code and docs were written with AI assistance (Claude), reviewed and directed by the team; commits credit it as co-author.
