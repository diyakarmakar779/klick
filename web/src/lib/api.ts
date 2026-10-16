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
  createQr: (eventId: string | null) => api<{ token: string; expiresAt: string }>("/v1/qr", { method: "POST", body: { eventId } }),
  previewQr: (token: string) => api(`/v1/qr/${token}`),
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
  score: number;
  reason: string;
  starter: string;
  source: "gemini" | "overlap";
  profile?: { displayName: string; headline: string };
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
  linkedin: (LinkedInCandidate & { confirmedAt: string }) | null;
  questionnaire: Questionnaire | null;
  onboarding: { step: "identity" | "integrations" | "questionnaire" | "done"; completedAt: string | null };
}
