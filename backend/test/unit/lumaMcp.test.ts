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

  it("publishes a client metadata document whose client_id is its own URL", () => {
    process.env.PUBLIC_API_URL = "https://api.example.com/";
    const doc = clientMetadataDocument();
    expect(doc.client_id).toBe("https://api.example.com/oauth/luma-client.json");
    expect(doc.token_endpoint_auth_method).toBe("none");
    expect(doc.redirect_uris).toContain("http://localhost:8976/callback");
  });
});
