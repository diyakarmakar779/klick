// Consent-aware connection exchange: who may move a connection to which status.
import type { Connection, ConnectionStatus } from "../db/schema.js";

export class ConsentError extends Error {
  constructor(message: string, readonly statusCode = 403) {
    super(message);
  }
}

export function connectionId(a: string, b: string, eventId: string | null): string {
  const [x, y] = [a, b].sort();
  return `${x}__${y}__${eventId ?? "none"}`;
}

export function otherMember(conn: Pick<Connection, "memberIds">, me: string): string {
  return conn.memberIds[0] === me ? conn.memberIds[1] : conn.memberIds[0];
}

type Action = "accept" | "decline" | "revoke" | "block";

// pending  --accept/decline (recipient only)--> accepted | declined
// pending  --revoke (requester withdraws)-----> revoked
// accepted --revoke (either side)-------------> revoked
// any      --block (either side)--------------> blocked
export function nextStatus(conn: Connection, actor: string, action: Action): ConnectionStatus {
  if (!conn.memberIds.includes(actor)) throw new ConsentError("Not a participant in this connection");
  if (conn.status === "blocked") throw new ConsentError("Connection is blocked", 409);
  const isRequester = conn.requestedBy === actor;

  switch (action) {
    case "accept":
    case "decline":
      if (conn.status !== "pending") throw new ConsentError(`Cannot ${action} a ${conn.status} connection`, 409);
      if (isRequester) throw new ConsentError("Only the recipient can respond to a request");
      return action === "accept" ? "accepted" : "declined";
    case "revoke":
      if (conn.status === "pending" && isRequester) return "revoked";
      if (conn.status === "accepted") return "revoked";
      throw new ConsentError(`Cannot revoke a ${conn.status} connection`, 409);
    case "block":
      return "blocked";
  }
}

// A new request is allowed unless the pair is blocked or already connected/pending.
export function canRequest(existing: Connection | null): { ok: true } | { ok: false; reason: string } {
  if (!existing) return { ok: true };
  if (existing.status === "blocked") return { ok: false, reason: "blocked" };
  if (existing.status === "pending" || existing.status === "accepted") return { ok: false, reason: existing.status };
  return { ok: true }; // declined/revoked can be re-requested
}
