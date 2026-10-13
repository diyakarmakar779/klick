import { describe, expect, it } from "vitest";
import { mergeState, normalizeIncomingState, safeWording } from "../../src/domain/membership.js";
import { canRequest, nextStatus } from "../../src/domain/consent.js";
import type { Connection } from "../../src/db/schema.js";

const prov = (source: string, sourceRef?: string, confidence = 0.9) => ({ source, sourceRef, capturedAt: new Date(), confidence });

describe("membership states", () => {
  it("uses the brief's safe wording and says nothing for unknown", () => {
    expect(safeWording("registered", "DevFest")).toBe("Planning to attend DevFest");
    expect(safeWording("attended", "DevFest")).toBe("Attended DevFest");
    expect(safeWording("unknown", "DevFest")).toBeNull();
  });

  it("only accepts 'attended' from a provider check-in", () => {
    expect(normalizeIncomingState("attended", prov("mock_luma", "checkin:1"))).toBe("attended");
    expect(normalizeIncomingState("attended", prov("mock_luma", "evt-1"))).toBe("registered");
    expect(normalizeIncomingState("attended", prov("manual", "checkin:1"))).toBe("registered");
  });

  it("keeps the more specific state when sources disagree", () => {
    const reg = { state: "registered" as const, provenance: prov("a") };
    const inv = { state: "invited" as const, provenance: prov("b") };
    expect(mergeState(reg, inv)).toBe(reg);
    expect(mergeState(inv, reg)).toBe(reg);
  });
});

describe("connection consent", () => {
  const base: Connection = {
    id: "a__b__e", memberIds: ["a", "b"], requestedBy: "a", eventId: "e", context: "",
    status: "pending", createdAt: new Date(), respondedAt: null, endedBy: null,
  };

  it("only the recipient can accept", () => {
    expect(() => nextStatus(base, "a", "accept")).toThrow();
    expect(nextStatus(base, "b", "accept")).toBe("accepted");
  });

  it("outsiders cannot act", () => {
    expect(() => nextStatus(base, "c", "block")).toThrow();
  });

  it("either side can revoke an accepted connection, and blocked is final", () => {
    expect(nextStatus({ ...base, status: "accepted" }, "b", "revoke")).toBe("revoked");
    expect(() => nextStatus({ ...base, status: "blocked" }, "a", "accept")).toThrow();
    expect(canRequest({ ...base, status: "blocked" })).toEqual({ ok: false, reason: "blocked" });
    expect(canRequest({ ...base, status: "declined" })).toEqual({ ok: true });
  });
});
