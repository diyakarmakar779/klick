// Thin client for the Cloud Run API. Every call carries the signed-in user's Firebase ID token.
import { auth } from "./firebase";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  status: number;
  retryable: boolean;
  constructor(status: number, message: string, retryable = false) {
    super(message);
    this.status = status;
    this.retryable = retryable;
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? res.statusText, !!data.retryable);
  return data as T;
}

// Examples of the main calls; see docs/ARCHITECTURE.md for the full list.
export const Api = {
  me: () => api<Me>("/v1/me"),
  saveMe: (body: Partial<Omit<Me, "id" | "onboarding" | "linkedin" | "questionnaire">>) => api<Me>("/v1/me", { method: "PUT", body }),
  skipIdentity: () => api<Me>("/v1/onboarding/identity/skip", { method: "POST" }),
  finishIntegrations: () => api<Me>("/v1/onboarding/integrations/done", { method: "POST" }),
  saveQuestionnaire: (body: Omit<Questionnaire, "updatedAt">) => api<Me>("/v1/onboarding/questionnaire", { method: "PUT", body }),
  sources: () => api<Array<{ provider: string; syncState: string; lastSyncAt: string | null }>>("/v1/sources"),
  syncCalendar: (accessToken: string) => api<{ imported: number; removed: number }>("/v1/sources/google_calendar/sync", { method: "POST", body: { accessToken } }),
  // Luma: send the member to `url`; Luma returns to /connect/luma/callback?code=&state=, which calls lumaCallback.
  lumaStart: (redirectUri: string) =>
    api<{ url: string; state: string }>(`/v1/sources/luma_mcp/start?redirectUri=${encodeURIComponent(redirectUri)}`),
  lumaCallback: (code: string, state: string) =>
    api<{ imported: number }>("/v1/sources/luma_mcp/callback", { method: "POST", body: { code, state } }),
  events: () => api<MyEvent[]>("/v1/events"),
  event: (eventId: string) => api<EventPage>(`/v1/events/${eventId}`),
  setGoal: (eventId: string, goal: string | null) => api(`/v1/events/${eventId}/goal`, { method: "PUT", body: { goal } }),
  linkedinStart: (redirectUri: string) =>
    api<{ url: string; state: string }>(`/v1/onboarding/linkedin/start?redirectUri=${encodeURIComponent(redirectUri)}`),
  linkedinCallback: (code: string, state: string) =>
    api<{ candidate: LinkedInCandidate }>("/v1/onboarding/linkedin/callback", { method: "POST", body: { code, state } }),
  linkedinConfirm: (isMe: boolean) => api<Me>("/v1/onboarding/linkedin/confirm", { method: "POST", body: { isMe } }),
  joinDemoEvents: () => api<{ imported: number }>("/v1/sources/mock_luma/connect", { method: "POST" }),
  setVisibility: (eventId: string, visibility: Visibility | null) =>
    api(`/v1/events/${eventId}/visibility`, { method: "PUT", body: { visibility } }),
  matches: (eventId: string) => api<{ ai: boolean; matches: Match[] }>(`/v1/events/${eventId}/matches`),
  requestKlick: (body: { to: string; eventId: string | null; context?: string; shareFields: ContactField[] }) =>
    api<Connection>("/v1/connections", { method: "POST", body }),
  connections: (status?: Connection["status"]) => api<KlickItem[]>(`/v1/connections${status ? `?status=${status}` : ""}`),
  actOnConnection: (id: string, action: "accept" | "decline" | "revoke" | "block", shareFields: ContactField[] = []) =>
    api<Connection>(`/v1/connections/${id}/${action}`, { method: "POST", body: { shareFields } }),
  connection: (id: string) => api<{ connection: Connection; other: PublicProfile | null; sharedContact: Partial<Record<ContactField, string>>; iShare: ContactField[] }>(`/v1/connections/${id}`),
  upload: (kind: "voice" | "photo", contentType: string) => api<{ storagePath: string; url: string }>("/v1/uploads", { method: "POST", body: { kind, contentType } }),
  memories: (connectionId?: string) => api<Memory[]>(`/v1/memories${connectionId ? `?connectionId=${connectionId}` : ""}`),
  createMemory: (body: { kind: Memory["kind"]; text: string | null; storagePath: string | null; connectionId: string | null; eventId: string | null }) =>
    api<Memory>("/v1/memories", { method: "POST", body }),
  analyzeMemory: (id: string) => api<Memory>(`/v1/memories/${id}/analyze`, { method: "POST" }),
  reviewMemory: (id: string, text: string) => api<Memory>(`/v1/memories/${id}/review`, { method: "POST", body: { text } }),
  shareMemory: (id: string, withId: string) => api<Memory>(`/v1/memories/${id}/share`, { method: "POST", body: { with: withId } }),
  deleteMemory: (id: string) => api(`/v1/memories/${id}`, { method: "DELETE" }),
  followUps: () => api<FollowUp[]>("/v1/followups"),
  createFollowUp: (body: { connectionId: string; reason: string; dueAt: string; sourceMemoryId: string | null }) =>
    api<FollowUp>("/v1/followups", { method: "POST", body }),
  draftFollowUp: (id: string, simpleLanguage: boolean) => api<FollowUp>(`/v1/followups/${id}/draft`, { method: "POST", body: { simpleLanguage } }),
  setFollowUp: (id: string, status: "sent" | "done" | "dismissed") => api<FollowUp>(`/v1/followups/${id}/${status}`, { method: "POST" }),
  createQr: (eventId: string | null) => api<{ token: string; expiresAt: string }>("/v1/qr", { method: "POST", body: { eventId } }),
  previewQr: (token: string) => api<QrPreview>(`/v1/qr/${token}`),
  requestByQr: (qrToken: string, shareFields: ContactField[], context = "") =>
    api<Connection>("/v1/connections", { method: "POST", body: { qrToken, shareFields, context } }),
};

export type Visibility = "hidden" | "confirmed_attendees" | "connections";
export type MembershipState = "host" | "invited" | "registered" | "attended" | "unknown";

export interface KlickEvent {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string | null;
  venue: { name: string | null; city: string | null; online: boolean };
  url: string | null;
  category: string | null;
  tags: string[];
  coverImageUrl: string | null;
  organizerName: string | null;
}

export interface MyEvent {
  event: KlickEvent;
  state: MembershipState;
  label: string | null;
  provenance: { source: string };
  visibility: Visibility | null;
  effectiveVisibility: Visibility;
  goal: string | null;
  people: { worthMeeting: PeopleSignal; catchUp: PeopleSignal };
}

// Counts and up to three initials; the list never carries names.
export interface PeopleSignal {
  count: number;
  initials: string[];
}

export interface Count {
  count: number | null;
  label: string;
}

export interface PublicProfile {
  id: string;
  displayName: string;
  headline: string;
  role: string;
  company: string;
}

export interface EventPage {
  event: KlickEvent;
  state: MembershipState;
  label: string | null;
  provenance: { source: string };
  visibility: Visibility | null;
  effectiveVisibility: Visibility;
  goal: string | null;
  onPlatformGoing: Count;
  discoverable: Count;
  connectionsGoing: PublicProfile[];
}

export interface Match {
  memberId: string;
  reason: string;
  starter: string;
  source: "gemini" | "overlap";
  profile?: PublicProfile;
}

export const CONTACT_FIELDS = ["email", "phone", "linkedin", "website", "x"] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];

export interface Connection {
  id: string;
  memberIds: string[];
  requestedBy: string;
  eventId: string | null;
  context: string;
  requestNote: { kind: "text" | "voice" | "photo"; text: string | null; storagePath: string | null } | null;
  status: "pending" | "accepted" | "declined" | "revoked" | "blocked";
  createdAt: string;
}

export interface KlickItem {
  connection: Connection;
  incoming: boolean;
  other: PublicProfile | null;
  event: { id: string; title: string; startsAt: string } | null;
  sharedContact: Partial<Record<ContactField, string>>;
}

export interface LinkedInCandidate {
  name: string;
  pictureUrl: string | null;
  email: string | null;
  emailMatchesAccount: boolean;
}

export interface Questionnaire {
  lookingFor: string[];
  lookingForDetail: string;
  offering: string[];
  offeringDetail: string;
  topics: string[];
  meetingStyle: "one_on_one" | "small_group" | "either";
}

export interface Accessibility {
  simpleLanguage: boolean;
  readAloud: boolean;
  prefersTextFirst: boolean;
  quietSpaces: boolean;
}

export interface Me {
  id: string;
  displayName: string;
  headline: string;
  role: string;
  company: string;
  interests: string[];
  goals: string[];
  accessibility: Accessibility;
  defaultVisibility: Visibility;
  contact: Partial<Record<ContactField, string>>;
  linkedin: (LinkedInCandidate & { confirmedAt: string }) | null;
  questionnaire: Questionnaire | null;
  onboarding: { step: "identity" | "integrations" | "questionnaire" | "done"; completedAt: string | null };
}

export interface QrPreview {
  profile: PublicProfile;
  eventId: string | null;
  event: { id: string; title: string } | null;
  availableContactFields: ContactField[];
  autoAccepts: boolean;
}

export interface Memory {
  id: string;
  connectionId: string | null;
  eventId: string | null;
  aboutMemberIds: string[];
  kind: "text" | "voice" | "photo";
  text: string | null;
  storagePath: string | null;
  aiDraft: string | null;
  ai: {
    summary: string;
    topics: string[];
    promises: Array<{ text: string; owner: "me" | "them" }>;
    suggestedFollowUp: { reason: string; dueAt: string } | null;
  } | null;
  reviewState: "draft" | "reviewed";
  sharedWith: string[];
  createdAt: string;
}

export interface FollowUp {
  id: string;
  connectionId: string;
  reason: string;
  dueAt: string;
  status: "open" | "prompted" | "sent" | "done" | "dismissed";
  draft: string | null;
  whyNow: string | null;
  sourceMemoryId: string | null;
}
