import { afterEach, describe, expect, it } from "vitest";
import { argSets, clientMetadataDocument, mapLumaEvents, nextCursor, pickEventsTool, toolPayload } from "../../src/lib/lumaMcp.js";

afterEach(() => {
  delete process.env.PUBLIC_API_URL;
  delete process.env.LUMA_EVENTS_TOOL;
});

describe("Luma MCP connector", () => {
  it("picks the read-only 'my events' tool and never a guest-list or write tool", () => {
    const tools = [
      { name: "create_event" }, { name: "list_event_guests" }, { name: "search_public_events" },
      { name: "get_event" }, { name: "list_my_events" }, { name: "update_event" },
    ];
    expect(pickEventsTool(tools)?.name).toBe("list_my_events");
    // Luma's real tool list (13 Oct 2026): list_events, not get_event (needs an id) or list_calendar_events.
    const luma = [{ name: "get_event" }, { name: "list_events" }, { name: "search_events" }, { name: "list_calendar_events" }, { name: "list_guests" }];
    expect(pickEventsTool(luma)?.name).toBe("list_events");
    expect(pickEventsTool([{ name: "get_event" }])).toBeNull();
    expect(pickEventsTool([{ name: "list_event_guests" }, { name: "create_event" }])).toBeNull();
    process.env.LUMA_EVENTS_TOOL = "get_event";
    expect(pickEventsTool(tools)?.name).toBe("get_event");
  });

  it("calls once per upcoming/past option when the tool has one", () => {
    const tool = { name: "list_my_events", inputSchema: { properties: { period: { enum: ["upcoming", "past", "all"] } } } };
    expect(argSets(tool)).toEqual([{ period: "upcoming" }, { period: "past" }]);
    expect(argSets({ name: "x" })).toEqual([{}]);
    expect(argSets({ name: "x", inputSchema: { properties: { include_past: { type: "boolean" } } } })).toEqual([{ include_past: true }]);
    expect(nextCursor({ entries: [], has_more: true, next_cursor: "abc" })).toBe("abc");
    expect(nextCursor({ entries: [], has_more: false, next_cursor: "abc" })).toBeNull();
  });

  it("maps Luma-shaped entries to true states, skipping declines and never inferring attendance", () => {
    const payload = toolPayload({
      content: [{ type: "text", text: JSON.stringify({ entries: [
        { event: { api_id: "evt-1", name: "DevFest", start_at: "2026-10-20T04:00:00Z", url: "https://lu.ma/devfest",
          geo_address_json: { address: "PIC", city: "Pune" }, cover_url: "https://img/1.png", guest_count: 640,
          hosts: [{ name: "GDG Pune" }], tags: [{ name: "AI" }] }, guest: { approval_status: "approved" } },
        { event: { api_id: "evt-2", name: "Past meetup", start_at: "2026-10-01T12:00:00Z" },
          guest: { approval_status: "approved", checked_in_at: "2026-10-01T12:10:00Z" } },
        { event: { api_id: "evt-3", name: "Hosted", start_at: "2026-11-01T12:00:00Z" }, role: "host" },
        { event: { api_id: "evt-4", name: "Nope", start_at: "2026-11-02T12:00:00Z" }, guest: { approval_status: "declined" } },
        { event: { api_id: "evt-5", name: "No status", start_at: "2026-11-03T12:00:00Z" } },
      ] }) }],
    });
    const byId = Object.fromEntries(mapLumaEvents(payload).map((e) => [e.externalId, e]));
    expect(Object.keys(byId).sort()).toEqual(["evt-1", "evt-2", "evt-3", "evt-5"]);
    expect(byId["evt-1"]).toMatchObject({ state: "registered", rawState: "approved", organizerName: "GDG Pune",
      guestCount: 640, tags: ["AI"], venue: { name: "PIC", city: "Pune", online: false } });
    expect(byId["evt-2"]).toMatchObject({ state: "attended", stateRef: "checkin:evt-2" });
    expect(byId["evt-3"].state).toBe("host");
    expect(byId["evt-5"].state).toBe("unknown");
    expect(() => toolPayload({ isError: true, content: [] })).toThrow("luma_tool_error");
  });

  it("maps Luma's real list_events shape (13 Oct 2026)", () => {
    const base = { start_at: "2026-11-14T06:30:00.000Z", end_at: "2026-11-14T10:30:00.000Z", timezone: "Asia/Calcutta",
      virtual_info: { has_access: true, raw_join_url: "https://meet.google.com/secret", zoom_id: null, password: null },
      visibility: "public", manager_info: null };
    const payload = toolPayload({ content: [{ type: "text", text: JSON.stringify({ has_more: false, entries: [
      { ...base, api_id: "evt-a", name: "Design meetup", url: "https://luma.com/abcd1234", cover_url: "https://img/a",
        location_type: "offline", geo_address_info: { type: "manual", address: "https://maps.app.goo.gl/x", mode: "shown" },
        calendar: { api_id: "cal-1", name: "Personal", slug: null }, hosts: [{ api_id: "usr-1", name: "Host One" }],
        guest_count: 30, host_info: null, guest_info: { approval_status: "approved" } },
      { ...base, api_id: "evt-b", name: "Mentor orientation", url: "https://luma.com/efgh5678", location_type: "meet",
        geo_address_info: null, calendar: { api_id: "cal-2", name: "ADPList", slug: "adplistcommunity" },
        hosts: [{ api_id: "usr-2", name: "ADPList" }], guest_count: 0, host_info: null, guest_info: { approval_status: "pending_approval" } },
      { ...base, api_id: "evt-c", name: "My workshop", location_type: "offline",
        geo_address_info: { address: "91springboard, Baner", city: "Pune" }, calendar: { name: "Personal" },
        hosts: [], host_info: { access_level: "manager" }, guest_info: null },
      { ...base, api_id: "evt-d", name: "Invited one", guest_info: { approval_status: "invited" }, host_info: null },
    ] }) }] });
    const byId = Object.fromEntries(mapLumaEvents(payload).map((e) => [e.externalId, e]));
    expect(byId["evt-a"]).toMatchObject({ state: "registered", rawState: "approved", organizerName: "Host One",
      guestCount: 30, coverImageUrl: "https://img/a", venue: { name: null, online: false }, url: "https://luma.com/abcd1234" });
    expect(byId["evt-b"]).toMatchObject({ state: "unknown", rawState: "pending_approval", organizerName: "ADPList", venue: { online: true } });
    expect(byId["evt-c"]).toMatchObject({ state: "host", rawState: "host", venue: { name: "91springboard, Baner", city: "Pune", online: false } });
    expect(byId["evt-d"].state).toBe("invited");
    expect(JSON.stringify(byId)).not.toContain("meet.google.com"); // meeting links are never kept
  });

  it("publishes a client metadata document whose client_id is its own URL", () => {
    process.env.PUBLIC_API_URL = "https://api.example.com/";
    const doc = clientMetadataDocument();
    expect(doc.client_id).toBe("https://api.example.com/oauth/luma-client.json");
    expect(doc.token_endpoint_auth_method).toBe("none");
    expect(doc.redirect_uris).toContain("http://localhost:8976/callback");
  });
});
