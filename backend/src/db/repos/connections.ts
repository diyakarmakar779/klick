import { getDb, fromFirestore } from "../firestore.js";
import { COLLECTIONS, Connection, type ContactField } from "../schema.js";
import { canRequest, connectionId, ConsentError, nextStatus, otherMember } from "../../domain/consent.js";
import { getEvent, getMembership } from "./events.js";
import { getMember, publicProfile } from "./members.js";

const col = () => getDb().collection(COLLECTIONS.connections);

export interface ConnectionRequest {
  eventId: string | null;
  context: string;
  requestNote: Connection["requestNote"];
  shareFields: ContactField[]; // what the requester offers to share once accepted
}

// Only keep fields the member actually has filled in.
async function ownedFields(memberId: string, fields: ContactField[]): Promise<ContactField[]> {
  const m = await getMember(memberId);
  return [...new Set(fields)].filter((f) => m?.contact[f]);
}

export async function requestConnection(requester: string, recipient: string, req: ConnectionRequest): Promise<Connection> {
  if (requester === recipient) throw new ConsentError("Cannot connect with yourself", 400);
  const recipientMember = await getMember(recipient);
  if (!recipientMember) throw new ConsentError("Member not found", 404);
  // If an event is named, both people must actually be on it; event context is never invented.
  if (req.eventId) {
    const [a, b] = await Promise.all([getMembership(requester, req.eventId), getMembership(recipient, req.eventId)]);
    if (!a || !b) throw new ConsentError("Both members must be on this event to attach it", 400);
  }
  const shareFields = await ownedFields(requester, req.shareFields);
  const autoAccept = recipientMember.connectionPreference === "auto_accept";
  const id = connectionId(requester, recipient, req.eventId);
  const ref = col().doc(id);
  return getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists ? fromFirestore<Connection>(snap.data()!) : null;
    const check = canRequest(existing);
    if (!check.ok) throw new ConsentError(`Connection already ${check.reason}`, 409);
    const now = new Date();
    const conn = Connection.parse({
      id,
      memberIds: [requester, recipient].sort(),
      requestedBy: requester,
      eventId: req.eventId,
      context: req.context,
      requestNote: req.requestNote,
      // Auto-accepting recipients share nothing until they choose to.
      sharedFields: { [requester]: shareFields, [recipient]: [] },
      status: autoAccept ? "accepted" : "pending",
      createdAt: now,
      respondedAt: autoAccept ? now : null,
      endedBy: null,
    });
    tx.set(ref, conn);
    return conn;
  });
}

export async function actOnConnection(
  id: string,
  actor: string,
  action: "accept" | "decline" | "revoke" | "block",
  shareFields: ContactField[] = [],
): Promise<Connection> {
  const fields = action === "accept" ? await ownedFields(actor, shareFields) : [];
  const ref = col().doc(id);
  return getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ConsentError("Connection not found", 404);
    const conn = fromFirestore<Connection>(snap.data()!);
    const status = nextStatus(conn, actor, action);
    const updated: Connection = {
      ...conn,
      status,
      sharedFields: action === "accept" ? { ...conn.sharedFields, [actor]: fields } : conn.sharedFields,
      respondedAt: action === "accept" || action === "decline" ? new Date() : conn.respondedAt,
      endedBy: action === "revoke" || action === "block" ? actor : conn.endedBy,
    };
    tx.set(ref, updated);
    return updated;
  });
}

// Change what I share on an accepted connection (e.g. after an auto-accept, or to stop sharing).
export async function updateSharedFields(id: string, actor: string, fields: ContactField[]): Promise<Connection> {
  const conn = await getConnectionFor(id, actor);
  if (conn.status !== "accepted") throw new ConsentError("Can only share on an accepted connection", 409);
  const updated = { ...conn, sharedFields: { ...conn.sharedFields, [actor]: await ownedFields(actor, fields) } };
  await col().doc(id).set(updated);
  return updated;
}

export async function listConnections(memberId: string, status?: Connection["status"]): Promise<Connection[]> {
  let q = col().where("memberIds", "array-contains", memberId);
  if (status) q = q.where("status", "==", status);
  const snap = await q.get();
  return snap.docs.map((d) => fromFirestore<Connection>(d.data()));
}

export async function getConnectionFor(id: string, memberId: string): Promise<Connection> {
  const snap = await col().doc(id).get();
  if (!snap.exists) throw new ConsentError("Connection not found", 404);
  const conn = fromFirestore<Connection>(snap.data()!);
  if (!conn.memberIds.includes(memberId)) throw new ConsentError("Connection not found", 404);
  return conn;
}

// Connection as one participant sees it: the other person's public profile, plus the contact
// values they chose to share, and only while the connection is accepted.
export async function connectionView(id: string, memberId: string) {
  const conn = await getConnectionFor(id, memberId);
  const otherId = otherMember(conn, memberId);
  const other = await getMember(otherId);
  const fields = conn.status === "accepted" ? conn.sharedFields[otherId] ?? [] : [];
  const sharedContact = Object.fromEntries(fields.filter((f) => other?.contact[f]).map((f) => [f, other!.contact[f]]));
  return {
    connection: conn,
    other: other ? publicProfile(other, conn.status === "accepted") : null,
    sharedContact,
    iShare: conn.sharedFields[memberId] ?? [],
  };
}

// Klicks tab: each connection with the other person's public profile and the event it came from.
// Contact details appear only once accepted, and only the fields the other person chose to share.
export async function listConnectionCards(memberId: string, status?: Connection["status"]) {
  const conns = await listConnections(memberId, status);
  return Promise.all(
    conns.map(async (conn) => {
      const otherId = otherMember(conn, memberId);
      const [other, event] = await Promise.all([getMember(otherId), conn.eventId ? getEvent(conn.eventId) : null]);
      const fields = conn.status === "accepted" ? conn.sharedFields[otherId] ?? [] : [];
      return {
        connection: conn,
        incoming: conn.requestedBy !== memberId,
        other: other ? publicProfile(other, conn.status === "accepted") : null,
        event: event ? { id: event.id, title: event.title, startsAt: event.startsAt } : null,
        sharedContact: Object.fromEntries(fields.filter((f) => other?.contact[f]).map((f) => [f, other!.contact[f]])),
      };
    }),
  );
}
