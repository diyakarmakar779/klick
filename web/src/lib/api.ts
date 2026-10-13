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
  syncCalendar: (accessToken: string) => api<{ imported: number }>("/v1/sources/google_calendar/sync", { method: "POST", body: { accessToken } }),
  // Luma: send the member to `url`; Luma returns to /connect/luma/callback?code=&state=, which calls lumaCallback.
  lumaStart: (redirectUri: string) =>
    api<{ url: string; state: string }>(`/v1/sources/luma_mcp/start?redirectUri=${encodeURIComponent(redirectUri)}`),
  lumaCallback: (code: string, state: string) =>
    api<{ imported: number }>("/v1/sources/luma_mcp/callback", { method: "POST", body: { code, state } }),
  events: () => api<unknown[]>("/v1/events"),
  matches: (eventId: string) => api<{ ai: boolean; matches: unknown[] }>(`/v1/events/${eventId}/matches`),
  createQr: (eventId: string | null) => api<{ token: string; expiresAt: string }>("/v1/qr", { method: "POST", body: { eventId } }),
  previewQr: (token: string) => api(`/v1/qr/${token}`),
};
