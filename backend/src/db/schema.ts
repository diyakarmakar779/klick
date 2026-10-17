// Firestore data model for Connected Event Networking.
// One Zod schema per entity in the brief. Every document carries provenance where the brief requires it.
import { z } from "zod";

export const COLLECTIONS = {
  members: "members",
  sourceConnections: "sourceConnections",
  events: "events",
  eventSourceRefs: "eventSourceRefs", // provider:externalId -> eventId, for dedupe across sources
  eventMemberships: "eventMemberships",
  connections: "connections",
  memoryObjects: "memoryObjects",
  followUps: "followUps",
  qrTokens: "qrTokens", // short-lived opaque tokens behind each member's QR code
  oauthStates: "oauthStates", // 10-minute PKCE state for provider sign-in; deleted when used
  saves: "saves", // private bookmarks: people a member wants to remember to meet at an event
  savedEvents: "savedEvents", // private bookmarks of Discover events, `${ownerId}__${eventId}`
} as const;

const timestamp = z.date();

export const Provenance = z.object({
  source: z.string(), // e.g. "luma_mcp", "mock_luma", "manual", "gemini"
  sourceRef: z.string().optional(), // provider-side id
  capturedAt: timestamp,
  confidence: z.number().min(0).max(1),
  rawState: z.string().optional(), // provider's own status, kept verbatim (e.g. Calendar "tentative")
});
export type Provenance = z.infer<typeof Provenance>;

// ---- Member: own profile, visibility, and sharing preferences
export const Visibility = z.enum(["hidden", "confirmed_attendees", "connections"]);
// Private contact details. Never shown before a connection; each side picks which keys to share on accept.
export const CONTACT_FIELDS = ["email", "phone", "linkedin", "website", "x"] as const;
export const ContactField = z.enum(CONTACT_FIELDS);
export type ContactField = z.infer<typeof ContactField>;

export const LinkedInIdentity = z.object({
  sub: z.string(), // pairwise id, specific to our app
  name: z.string(),
  pictureUrl: z.string().nullable(),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  emailMatchesAccount: z.boolean(), // LinkedIn email == Google sign-in email
  confirmedAt: timestamp.nullable(),
});
export type LinkedInIdentity = z.infer<typeof LinkedInIdentity>;

// LinkedIn public profile names are 3-100 letters, numbers or hyphens: linkedin.com/in/<username>.
export const LinkedInUsername = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9-]{3,100}$/, "Use the part after linkedin.com/in/");

// The member's own LinkedIn page, typed in by them. Self-reported: only "Sign in with LinkedIn" counts as linked.
export const LinkedInProfile = z.object({
  username: LinkedInUsername,
  url: z.string(),
  source: z.literal("self_reported"),
  addedAt: timestamp,
});
export type LinkedInProfile = z.infer<typeof LinkedInProfile>;

// Onboarding questionnaire: the member's own words, used as matching context.
export const Questionnaire = z.object({
  lookingFor: z.array(z.string().max(60)).max(8).default([]), // e.g. "co-founder", "backend engineer to hire"
  lookingForDetail: z.string().max(500).default(""),
  offering: z.array(z.string().max(60)).max(8).default([]), // e.g. "mentoring", "design feedback"
  offeringDetail: z.string().max(500).default(""),
  topics: z.array(z.string().max(40)).max(15).default([]),
  meetingStyle: z.enum(["one_on_one", "small_group", "either"]).default("either"),
  updatedAt: timestamp,
});
export type Questionnaire = z.infer<typeof Questionnaire>;
export const Member = z.object({
  id: z.string(), // Firebase Auth uid
  displayName: z.string().min(1).max(80),
  headline: z.string().max(140).default(""),
  role: z.string().max(80).default(""),
  company: z.string().max(80).default(""),
  bio: z.string().max(1000).default(""),
  interests: z.array(z.string().max(40)).max(20).default([]),
  goals: z.array(z.string().max(140)).max(10).default([]),
  languages: z.array(z.string()).default(["en"]),
  accessibility: z
    .object({
      simpleLanguage: z.boolean().default(false),
      readAloud: z.boolean().default(false),
      prefersTextFirst: z.boolean().default(false),
      quietSpaces: z.boolean().default(false),
    })
    .default({}),
  defaultVisibility: Visibility.default("hidden"),
  contact: z.record(ContactField, z.string().max(200)).default({}),
  // "review": every request waits for approval. "auto_accept": showing your QR is your consent.
  connectionPreference: z.enum(["review", "auto_accept"]).default("review"),
  // Identity from "Sign in with LinkedIn" (OIDC). LinkedIn only returns name, photo and email,
  // so headline/role/company come from the member (typed, or extracted from their own profile PDF).
  linkedin: LinkedInIdentity.nullable().default(null),
  linkedinCandidate: LinkedInIdentity.nullable().default(null), // awaiting "Is this you?"
  linkedinProfile: LinkedInProfile.nullable().default(null),
  questionnaire: Questionnaire.nullable().default(null),
  onboarding: z
    .object({
      step: z.enum(["identity", "integrations", "questionnaire", "done"]).default("identity"),
      completedAt: timestamp.nullable().default(null),
    })
    .default({}),
  // Embedding of profile text for matching; written server-side only.
  embedding: z.array(z.number()).optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Member = z.infer<typeof Member>;

// ---- Source connection: provider, permission scope, sync state, provenance
export const Provider = z.enum(["google_calendar", "luma_mcp", "meetup", "mock_luma", "seed"]);
export const SourceConnection = z.object({
  id: z.string(),
  memberId: z.string(),
  provider: Provider,
  scopes: z.array(z.string()), // what the member granted
  // Pointer to the encrypted token (Secret Manager version name). The token itself is never stored here.
  tokenRef: z.string().nullable(),
  syncState: z.enum(["pending", "syncing", "ok", "error", "revoked"]),
  lastSyncAt: timestamp.nullable(),
  lastError: z.string().nullable(),
  consentedAt: timestamp,
  createdAt: timestamp,
});
export type SourceConnection = z.infer<typeof SourceConnection>;

// ---- Event: normalized identity and available context
export const Event = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(""),
  startsAt: timestamp,
  endsAt: timestamp.nullable(),
  timezone: z.string().nullable(),
  venue: z.object({ name: z.string().nullable(), city: z.string().nullable(), online: z.boolean() }),
  url: z.string().nullable(),
  // Luma-style details, filled from whichever source has them.
  category: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  coverImageUrl: z.string().nullable().default(null),
  organizerName: z.string().nullable().default(null),
  providerGuestCount: z.number().int().nullable().default(null), // the provider's own public "N going", if it shows one
  // Shared key for the same event seen through different sources (e.g. "luma:devfest-pune-2026").
  canonicalKey: z.string().nullable().default(null),
  sourceRefs: z.array(z.object({ provider: Provider, externalId: z.string(), url: z.string().nullable() })),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Event = z.infer<typeof Event>;

// ---- Event membership: member, event, state, source, confidence, visibility
export const MembershipState = z.enum(["host", "invited", "registered", "attended", "unknown"]);
export type MembershipState = z.infer<typeof MembershipState>;
export const EventMembership = z.object({
  id: z.string(), // `${memberId}__${eventId}`
  memberId: z.string(),
  eventId: z.string(),
  state: MembershipState,
  provenance: Provenance,
  // Member's choice for this event; null means "use my default".
  visibility: Visibility.nullable(),
  goal: z.string().max(280).nullable().default(null), // "Why are you attending?", used for matching
  // The member's own answer to "Did you go?" on a past event. Never changes `state`: only a provider can verify attendance.
  selfReport: z.enum(["went", "didnt"]).nullable().default(null),
  // Denormalized effective visibility so matching can query on it.
  effectiveVisibility: Visibility,
  updatedAt: timestamp,
});
export type EventMembership = z.infer<typeof EventMembership>;

// ---- Connection: two consenting members and the context of exchange
export const ConnectionStatus = z.enum(["pending", "accepted", "declined", "revoked", "blocked"]);
export type ConnectionStatus = z.infer<typeof ConnectionStatus>;
export const Connection = z.object({
  id: z.string(), // deterministic: sorted member ids + event id
  memberIds: z.array(z.string()).length(2), // sorted, for array-contains queries
  requestedBy: z.string(),
  eventId: z.string().nullable(),
  context: z.string().max(280).default(""), // why/where they met, as stated by requester
  // Context attached to the request (text, photo or voice). Sent deliberately, so both sides keep it
  // and it pins to the top of their thread. Separate from each person's private memories.
  requestNote: z
    .object({ kind: z.enum(["text", "voice", "photo"]), text: z.string().max(500).nullable(), storagePath: z.string().nullable() })
    .nullable()
    .default(null),
  // Contact fields each member chose to share, keyed by member id. Only readable once accepted.
  sharedFields: z.record(z.string(), z.array(ContactField)).default({}),
  status: ConnectionStatus,
  createdAt: timestamp,
  respondedAt: timestamp.nullable(),
  endedBy: z.string().nullable(), // who revoked/blocked
});
export type Connection = z.infer<typeof Connection>;

// ---- Memory object: private notes, media, provenance, review state
export const MemoryObject = z.object({
  id: z.string(),
  ownerId: z.string(),
  connectionId: z.string().nullable(),
  eventId: z.string().nullable(),
  aboutMemberIds: z.array(z.string()).default([]),
  kind: z.enum(["text", "voice", "photo"]),
  text: z.string().max(5000).nullable(), // note body, or transcript for voice
  storagePath: z.string().nullable(), // gs:// path for voice/photo
  aiDraft: z.string().nullable(), // Gemini summary awaiting review
  ai: z
    .object({
      summary: z.string(),
      topics: z.array(z.string()),
      promises: z.array(z.object({ text: z.string(), owner: z.enum(["me", "them"]) })),
      suggestedFollowUp: z.object({ reason: z.string(), dueAt: timestamp }).nullable(),
      model: z.string(),
      promptVersion: z.string(),
      at: timestamp,
    })
    .nullable()
    .default(null),
  reviewState: z.enum(["draft", "reviewed"]),
  sharedWith: z.array(z.string()).default([]), // empty = private to author
  provenance: Provenance,
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type MemoryObject = z.infer<typeof MemoryObject>;

// ---- Follow-up intent: owner, reason, timing, completion state
export const FollowUp = z.object({
  id: z.string(),
  ownerId: z.string(),
  connectionId: z.string(),
  reason: z.string().max(500),
  dueAt: timestamp,
  status: z.enum(["open", "prompted", "sent", "done", "dismissed"]),
  draft: z.string().nullable(), // Gemini draft; the member sends it themselves
  whyNow: z.string().nullable().default(null),
  sourceMemoryId: z.string().nullable().default(null),
  promptedAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type FollowUp = z.infer<typeof FollowUp>;

// ---- QR token: opaque, short-lived, resolves to a member without exposing their id in the code
export const QrToken = z.object({
  id: z.string(),
  memberId: z.string(),
  eventId: z.string().nullable(),
  expiresAt: timestamp,
  createdAt: timestamp,
});
export type QrToken = z.infer<typeof QrToken>;

// ---- Save: a private bookmark of someone worth meeting at an event. Only its owner ever reads it,
// and the saved person is never told.
export const Save = z.object({
  id: z.string(), // `${ownerId}__${eventId}__${memberId}`
  ownerId: z.string(),
  eventId: z.string(),
  memberId: z.string(),
  reason: z.string().max(500).nullable(), // the suggestion's reason when it was saved, for the owner's own reminder
  createdAt: timestamp,
});
export type Save = z.infer<typeof Save>;
