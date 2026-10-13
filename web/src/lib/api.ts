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
  me: () => api<Record<string, unknown>>("/v1/me"),
  saveMe: (body: Record<string, unknown>) => api("/v1/me", { method: "PUT", body }),
  syncCalendar: (accessToken: string) => api<{ imported: number; removed: number }>("/v1/sources/google_calendar/sync", { method: "POST", body: { accessToken } }),
  // Luma: send the member to `url`; Luma returns to /connect/luma/callback?code=&state=, which calls lumaCallback.
  lumaStart: (redirectUri: string) =>
    api<{ url: string; state: string }>(`/v1/sources/luma_mcp/start?redirectUri=${encodeURIComponent(redirectUri)}`),
  lumaCallback: (code: string, state: string) =>
    api<{ imported: number }>("/v1/sources/luma_mcp/callback", { method: "POST", body: { code, state } }),
  events: () => api<MyEvent[]>("/v1/events"),
  linkedinStart: (redirectUri: string) =>
    api<{ url: string; state: string }>(`/v1/onboarding/linkedin/start?redirectUri=${encodeURIComponent(redirectUri)}`),
  linkedinCallback: (code: string, state: string) =>
    api<{ candidate: LinkedInCandidate }>("/v1/onboarding/linkedin/callback", { method: "POST", body: { code, state } }),
  linkedinConfirm: (isMe: boolean) => api<Record<string, unknown>>("/v1/onboarding/linkedin/confirm", { method: "POST", body: { isMe } }),
  joinDemoEvents: () => api<{ imported: number }>("/v1/sources/mock_luma/connect", { method: "POST" }),
  setVisibility: (eventId: string, visibility: "hidden" | "confirmed_attendees" | "connections" | null) =>
    api(`/v1/events/${eventId}/visibility`, { method: "PUT", body: { visibility } }),
  matches: (eventId: string) => api<{ ai: boolean; matches: Match[] }>(`/v1/events/${eventId}/matches`),
  createQr: (eventId: string | null) => api<{ token: string; expiresAt: string }>("/v1/qr", { method: "POST", body: { eventId } }),
  previewQr: (token: string) => api(`/v1/qr/${token}`),
};

export interface MyEvent {
  event: { id: string; title: string; startsAt: string };
  state: string;
  label: string | null;
  effectiveVisibility: string;
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
