// Luma connector over Luma's official MCP server (https://mcp.luma.com).
//
// Auth: OAuth 2.1 + PKCE. Luma has no client registration; instead our client_id is the URL of a small JSON
// document we host (an OAuth Client ID Metadata Document), which Luma fetches to learn our name and redirect URIs.
// The access token is used once to read the member's own events and then dropped (rule R4).
//
// Luma documents capabilities, not tool names, so we discover the "my events" tool at runtime and map its
// output defensively. LUMA_EVENTS_TOOL / LUMA_EVENTS_TOOL_ARGS pin the tool once we've seen the real list
// (`npm run luma:inspect`). We never call guest-list or write tools (rules R1, R3).
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { discoverOAuthServerInfo, exchangeAuthorization, startAuthorization } from "@modelcontextprotocol/sdk/client/auth.js";
import type { ImportedEvent } from "../db/repos/events.js";
import type { MembershipState } from "../db/schema.js";

export const LUMA_MCP_URL = process.env.LUMA_MCP_URL ?? "https://mcp.luma.com";

// The client_id. Must be a public https URL serving clientMetadataDocument() byte-for-byte with the same client_id.
export function lumaClientId(): string {
  if (process.env.LUMA_CLIENT_ID) return process.env.LUMA_CLIENT_ID;
  const api = process.env.PUBLIC_API_URL;
  if (!api) throw new Error("luma_not_configured");
  return `${api.replace(/\/$/, "")}/oauth/luma-client.json`;
}

export function lumaRedirectUris(): string[] {
  const fromEnv = process.env.LUMA_REDIRECT_URIS?.split(",").map((s) => s.trim()).filter(Boolean);
  if (fromEnv?.length) return fromEnv;
  const web = process.env.WEB_URL?.replace(/\/$/, "");
  return [
    ...(web ? [`${web}/connect/luma/callback`] : []),
    "http://localhost:5173/connect/luma/callback", // web dev server
    "http://localhost:8976/callback", // npm run luma:inspect
  ];
}

export function clientMetadataDocument() {
  return {
    client_id: lumaClientId(),
    client_name: "hey-os",
    client_uri: process.env.WEB_URL ?? "https://github.com/diyakarmakar779/hey-os",
    redirect_uris: lumaRedirectUris(),
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  };
}

export async function startLumaAuth(redirectUri: string, state: string) {
  if (!lumaRedirectUris().includes(redirectUri)) throw new Error("luma_redirect_not_allowed");
  const info = await discoverOAuthServerInfo(LUMA_MCP_URL);
  const scopes = info.resourceMetadata?.scopes_supported;
  const { authorizationUrl, codeVerifier } = await startAuthorization(info.authorizationServerUrl, {
    metadata: info.authorizationServerMetadata,
    clientInformation: { client_id: lumaClientId() },
    redirectUrl: redirectUri,
    scope: scopes?.length ? scopes.join(" ") : undefined,
    state,
    resource: info.resourceMetadata?.resource ?? LUMA_MCP_URL,
  });
  return { url: authorizationUrl.toString(), codeVerifier, authServerUrl: info.authorizationServerUrl };
}

export async function finishLumaAuth(p: { code: string; codeVerifier: string; redirectUri: string }): Promise<string> {
  const info = await discoverOAuthServerInfo(LUMA_MCP_URL);
  const tokens = await exchangeAuthorization(info.authorizationServerUrl, {
    metadata: info.authorizationServerMetadata,
    clientInformation: { client_id: lumaClientId() },
    authorizationCode: p.code,
    codeVerifier: p.codeVerifier,
    redirectUri: p.redirectUri,
    resource: info.resourceMetadata?.resource ?? LUMA_MCP_URL,
  });
  return tokens.access_token; // refresh token, if any, is ignored on purpose
}

export async function withLuma<T>(accessToken: string, fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ name: "hey-os", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(LUMA_MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

type Tool = { name: string; description?: string; inputSchema?: { properties?: Record<string, { enum?: unknown[] }> } };

// Pick the read-only "list my events" tool. Never anything that writes or touches guest lists.
export function pickEventsTool(tools: Tool[]): Tool | null {
  const pinned = process.env.LUMA_EVENTS_TOOL;
  if (pinned) return tools.find((t) => t.name === pinned) ?? null;
  const forbidden = /(create|update|delete|add|remove|approve|decline|send|invite|guest|contact|coupon|ticket|blast|calendar|search|discover|public|host_)/i;
  const candidates = tools.filter((t) => /event/i.test(t.name) && !forbidden.test(t.name));
  const score = (t: Tool) =>
    (/(my|user|own|attend|registered|upcoming|past)/i.test(t.name) ? 4 : 0) +
    (/(list|get)/i.test(t.name) ? 2 : 0) +
    (/(your|attendee|attending|registered)/i.test(t.description ?? "") ? 1 : 0);
  return candidates.sort((a, b) => score(b) - score(a))[0] ?? null;
}

// If the tool takes an enum like {period: "upcoming" | "past"}, call it once per value; else once with no args.
export function argSets(tool: Tool): Record<string, unknown>[] {
  if (process.env.LUMA_EVENTS_TOOL_ARGS) return JSON.parse(process.env.LUMA_EVENTS_TOOL_ARGS);
  for (const [key, prop] of Object.entries(tool.inputSchema?.properties ?? {})) {
    const values = (prop.enum ?? []).map(String);
    const wanted = values.filter((v) => /^(upcoming|past|future|previous)$/i.test(v));
    if (wanted.length) return wanted.map((v) => ({ [key]: v }));
  }
  return [{}];
}

export async function fetchLumaEvents(accessToken: string): Promise<ImportedEvent[]> {
  return withLuma(accessToken, async (client) => {
    const { tools } = await client.listTools();
    const tool = pickEventsTool(tools as Tool[]);
    if (!tool) throw new Error("luma_events_tool_not_found");
    const out: ImportedEvent[] = [];
    for (const args of argSets(tool)) {
      const res = await client.callTool({ name: tool.name, arguments: args });
      out.push(...mapLumaEvents(toolPayload(res)));
    }
    const seen = new Set<string>();
    return out.filter((e) => !seen.has(e.externalId) && !!seen.add(e.externalId));
  });
}

// MCP results carry either structuredContent or JSON in text blocks.
export function toolPayload(res: unknown): unknown {
  const r = res as { structuredContent?: unknown; content?: { type: string; text?: string }[]; isError?: boolean };
  if (r.isError) throw new Error("luma_tool_error");
  if (r.structuredContent) return r.structuredContent;
  const parsed = (r.content ?? [])
    .filter((c) => c.type === "text" && c.text)
    .map((c) => {
      try {
        return JSON.parse(c.text!);
      } catch {
        return null;
      }
    })
    .filter((x) => x !== null);
  return parsed.length === 1 ? parsed[0] : parsed;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const first = (o: Obj, ...keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined && v !== null);

// Luma's public API shapes entries as {event, guest?, role?} or a bare event; accept both and walk nested lists.
export function mapLumaEvents(payload: unknown): ImportedEvent[] {
  const found: ImportedEvent[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!isObj(v)) return;
    const mapped = mapEntry(v);
    if (mapped === "skip") return;
    if (mapped) return void found.push(mapped);
    Object.values(v).forEach(walk);
  };
  walk(payload);
  return found;
}

function mapEntry(entry: Obj): ImportedEvent | "skip" | null {
  const ev = isObj(entry.event) ? entry.event : entry;
  const id = str(first(ev, "api_id", "id", "event_id", "slug"));
  const title = str(first(ev, "name", "title"));
  const start = str(first(ev, "start_at", "startsAt", "start_time", "start"));
  if (!id || !title || !start || Number.isNaN(Date.parse(start))) return null;

  const guest = isObj(entry.guest) ? entry.guest : isObj(entry.registration) ? entry.registration : entry;
  const state = lumaState(entry, guest);
  if (!state) return "skip"; // declined: skip, same as Calendar
  const geo = isObj(ev.geo_address_json) ? ev.geo_address_json : isObj(ev.location) ? ev.location : {};
  const end = str(first(ev, "end_at", "endsAt", "end_time", "end"));
  const checkedIn = str(first(guest, "checked_in_at", "check_in_at"));
  const count = first(ev, "guest_count", "guests_count", "going_count");
  const tags = first(ev, "tags", "categories");
  return {
    externalId: id,
    title,
    description: (str(first(ev, "description", "description_md")) ?? "").slice(0, 2000),
    startsAt: new Date(start),
    endsAt: end && !Number.isNaN(Date.parse(end)) ? new Date(end) : null,
    timezone: str(ev.timezone),
    venue: {
      name: str(first(geo, "address", "full_address", "name")) ?? str(ev.location_name),
      city: str(first(geo, "city", "city_state")),
      online: !!str(first(ev, "meeting_url", "zoom_meeting_url")) && !str(first(geo, "address", "full_address")),
    },
    url: str(ev.url) ?? (str(ev.slug) ? `https://lu.ma/${ev.slug}` : null),
    category: str(first(ev, "category", "event_type")),
    tags: Array.isArray(tags) ? tags.map((t) => (isObj(t) ? str(t.name) : str(t))).filter((t): t is string => !!t) : [],
    coverImageUrl: str(first(ev, "cover_url", "cover_image_url")),
    organizerName: str(first(ev, "calendar_name", "organizer_name")) ?? hostName(ev),
    guestCount: typeof count === "number" ? count : null,
    state,
    stateRef: checkedIn ? `checkin:${id}` : undefined,
    rawState: str(first(guest, "approval_status", "status", "registration_status")) ?? str(entry.role) ?? undefined,
    confidence: state === "unknown" ? 0.3 : 0.95,
  };
}

function hostName(ev: Obj): string | null {
  const hosts = first(ev, "hosts");
  return Array.isArray(hosts) && isObj(hosts[0]) ? str(hosts[0].name) : null;
}

// Luma guest status -> our states. A check-in timestamp is the only "attended" signal (rule R7).
function lumaState(entry: Obj, guest: Obj): MembershipState | null {
  const role = String(first(entry, "role", "user_role") ?? "").toLowerCase();
  if (/host|organizer|manager|admin/.test(role) || entry.is_host === true) return "host";
  if (str(first(guest, "checked_in_at", "check_in_at"))) return "attended";
  const s = String(first(guest, "approval_status", "status", "registration_status") ?? "").toLowerCase();
  if (/declined|rejected|cancel/.test(s)) return null;
  if (/approved|going|registered|accepted|confirmed/.test(s)) return "registered";
  if (/invited|pending|waitlist/.test(s)) return "invited";
  return "unknown"; // no status from Luma: show nothing rather than guess
}
