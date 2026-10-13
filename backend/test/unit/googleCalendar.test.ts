import { describe, expect, it } from "vitest";
import { mapParticipation, toImportedEvent } from "../../src/lib/googleCalendar.js";

const base = { id: "x", iCalUID: "uid-1@google.com", summary: "Event X", start: { dateTime: "2026-10-15T10:00:00+05:30" } };

describe("Google Calendar mapping", () => {
  it("keeps the real source state and never produces attended", () => {
    expect(mapParticipation({ ...base, organizer: { self: true } })).toEqual({ state: "host", rawState: "organizer" });
    expect(mapParticipation({ ...base, attendees: [{ self: true, responseStatus: "accepted" }] })?.state).toBe("registered");
    expect(mapParticipation({ ...base, attendees: [{ self: true, responseStatus: "tentative" }] })).toEqual({ state: "invited", rawState: "tentative" });
    expect(mapParticipation({ ...base, attendees: [{ self: true, responseStatus: "needsAction" }] })?.state).toBe("invited");
    expect(mapParticipation({ ...base, attendees: [{ email: "x" } as never] })?.state).toBe("unknown");
  });

  it("skips declined and cancelled events, and uses iCalUID for identity", () => {
    expect(toImportedEvent({ ...base, attendees: [{ self: true, responseStatus: "declined" }] })).toBeNull();
    expect(toImportedEvent({ ...base, status: "cancelled", organizer: { self: true } })).toBeNull();
    expect(toImportedEvent({ ...base, organizer: { self: true } })?.externalId).toBe("uid-1@google.com");
  });
});
