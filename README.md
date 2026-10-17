# hey-os

Building a layer for human connections that helps people discover, remember, and reconnect with people they meet or miss at meetups, gatherings, and conferences.

Consent-first networking for before, during and after events: members connect Google Calendar and Luma, get matched by Gemini with people who share context, exchange connections only when both accept, keep private memories, and get prompted to reconnect. Built for the AI Builder Cup 2026 (Sustainability & Social Impact).

Architecture, schema and guardrails: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## Layout

```
backend/                 Node 22 + TypeScript + Fastify, deployed to Cloud Run
  src/db/schema.ts       Zod schemas for the 7 entities in the brief (single source of truth)
  src/db/repos/          Firestore reads/writes per entity
  src/ai/                Gemini: match ranking, memory extraction, reconnection drafts (schema-validated)
  src/services/ai.ts     Permission checks before any data reaches Gemini
  src/domain/            Pure rules: membership states + safe wording, connection consent state machine
  src/lib/lumaMcp.ts     Luma connector over Luma's official MCP server (OAuth + PKCE, own events only)
  src/lib/mockLuma.ts    Luma-shaped mock connector, for demos without a Luma account
  src/server.ts          REST API (/v1/...)
  firestore.rules        Clients get no direct access; everything goes through the API
  firestore.indexes.json Composite indexes + vector index for matching embeddings
  scripts/seed.ts        12 demo members on the same mock Luma events
  test/                  Unit tests + API tests against the Firestore emulator
web/                     React + TypeScript + Vite, deployed to Firebase Hosting (sign-in gate for now)
infra/gcp-setup.sh       One-time Google Cloud setup and deploy
docs/ARCHITECTURE.md     Architecture, data model, AI design, privacy rules, judging guardrails
.github/                 CI (backend tests on the Firestore emulator, web lint + build) and PR template
```

## Run locally

Needs Node 20+ and Java 11+ (for the Firestore emulator).

```bash
cd backend
npm install
npm test                       # starts the emulator, runs 25 tests
npm run emulators              # terminal 1: emulator on 127.0.0.1:8081
cp .env.example .env           # terminal 2:
export $(cat .env | xargs)
npm run seed
npm run dev                    # API on http://localhost:8080
curl -H 'x-dev-member: demo-asha' localhost:8080/v1/events
```

`AUTH_MODE=dev` lets the `x-dev-member` header stand in for a Firebase login. Never set it in Cloud Run.

## Deploy to Google Cloud

```bash
gcloud auth login && gcloud auth application-default login
PROJECT_ID=your-project-id ./infra/gcp-setup.sh
```

The script creates or reuses the project, checks billing, enables APIs, creates Firestore (asia-south1), a private media bucket, a least-privilege service account, a `job-secret` secret, adds Firebase, deploys rules and indexes, deploys the API to Cloud Run and schedules the hourly reconnection job.

## Data model

| Collection | Doc id | Key fields |
|---|---|---|
| `members` | Firebase uid | profile, interests, goals, accessibility prefs, `defaultVisibility`, `embedding` (768-d) |
| `sourceConnections` | `{memberId}__{provider}` | provider, scopes, `tokenRef` (Secret Manager pointer, never the token), syncState, consentedAt |
| `events` | auto | normalized title/time/venue, `sourceRefs[]` |
| `eventSourceRefs` | `{provider}__{externalId}` | eventId (dedupe across members and sources) |
| `eventMemberships` | `{memberId}__{eventId}` | state (host/invited/registered/attended/unknown), provenance, visibility, effectiveVisibility |
| `connections` | `{a}__{b}__{eventId}` (sorted) | memberIds, requestedBy, status (pending/accepted/declined/revoked/blocked) |
| `memoryObjects` | auto | ownerId, kind (text/voice/photo), text, storagePath, aiDraft, reviewState, sharedWith, provenance |
| `followUps` | auto | ownerId, connectionId, reason, dueAt, status, draft |

## Rules the code enforces

- "Attended" only from a provider check-in record; everything else is downgraded to "Planning to attend". "Unknown" shows no label.
- Matching pool = other members confirmed for the event who chose `confirmed_attendees` visibility.
- Connections need the recipient to accept; requester can withdraw; either side can revoke or block; blocked can't be re-requested.
- Memories are owner-only; sharing is an explicit call and only to the accepted connection the memory is about.
- Follow-ups need an accepted connection and are never sent by the system.
- Disconnecting a source deletes every membership it created.

## API (all under `/v1`, Bearer Firebase ID token)

`GET/PUT /me` · `GET /members/:id` · `PUT /onboarding/step` · `GET /onboarding/linkedin/start` · `PUT /onboarding/linkedin/username` · `POST /onboarding/linkedin/{callback|confirm}` · `POST /onboarding/identity/skip` · `POST /onboarding/integrations/done` · `PUT /onboarding/questionnaire` · `GET /sources` · `POST /sources/google_calendar/sync` · `POST /sources/mock_luma/connect` · `DELETE /sources/:provider` · `GET /events` · `PUT /events/:id/{visibility|goal}` · `GET /events/:id/matches` (Gemini) · `POST /qr` · `GET /qr/:token` (preview) · `POST /connections` (`to` or `qrToken`) · `GET /connections` · `GET /connections/:id` · `PUT /connections/:id/shared-fields` · `POST /uploads` (signed URL) · `POST /connections/:id/{accept|decline|revoke|block}` · `POST/GET /memories` · `POST /memories/:id/{analyze|review|share}` · `DELETE /memories/:id` · `POST/GET /followups` · `POST /followups/:id/draft` (Gemini) · `POST /followups/:id/{sent|done|dismissed}` · `POST /jobs/reconnect` (scheduler, secret header)

## Web app (local)

```bash
cd web
cp .env.example .env.local   # fill in Firebase web config and API URL
npm install && npm run dev
```

Deploy: `npm run build` in `web/`, then `npx firebase-tools deploy --only hosting` from the repo root.

## What's next

See the priority table in the project plan and the open items at the end of [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Trying the real Luma connection

Luma signs apps in with a public "client id" URL, so the API must be reachable on the internet first (deploy with `infra/gcp-setup.sh`, which sets `PUBLIC_API_URL`). Then, from `backend/`:

```bash
LUMA_CLIENT_ID=https://<your-cloud-run-url>/oauth/luma-client.json npm run luma:inspect
```

It opens Luma's sign-in, lists the tools Luma offers, and prints your own events as hey-os would import them. Nothing is saved.

## Team and tools

Built by Diya and Sivasurya. Parts of the code and docs were written with AI assistance (Claude), reviewed and directed by the team; commits credit it as co-author.
