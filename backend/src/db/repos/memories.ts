// Memory objects and follow-up intents. Both are private to their owner by default (rule R8):
// every read here is scoped by ownerId, and sharing a memory is a separate explicit call.
import { getDb, fromFirestore } from "../firestore.js";
import { COLLECTIONS, FollowUp, MemoryObject } from "../schema.js";
import { ConsentError, otherMember } from "../../domain/consent.js";
import { getConnectionFor } from "./connections.js";
import { deleteObject, ownsPath } from "../../lib/storage.js";

const memories = () => getDb().collection(COLLECTIONS.memoryObjects);
const followUps = () => getDb().collection(COLLECTIONS.followUps);

export async function createMemory(
  ownerId: string,
  input: Pick<MemoryObject, "kind" | "text" | "storagePath" | "connectionId" | "eventId"> & {
    aiDraft?: string | null;
    source?: string;
  },
): Promise<MemoryObject> {
  if (!ownsPath(ownerId, input.storagePath)) throw new ConsentError("Media must be your own upload", 403);
  let aboutMemberIds: string[] = [];
  if (input.connectionId) {
    const conn = await getConnectionFor(input.connectionId, ownerId);
    aboutMemberIds = [otherMember(conn, ownerId)];
  }
  const now = new Date();
  const ref = memories().doc();
  const memory = MemoryObject.parse({
    id: ref.id,
    ownerId,
    connectionId: input.connectionId ?? null,
    eventId: input.eventId ?? null,
    aboutMemberIds,
    kind: input.kind,
    text: input.text ?? null,
    storagePath: input.storagePath ?? null,
    aiDraft: input.aiDraft ?? null,
    reviewState: input.aiDraft ? "draft" : "reviewed",
    sharedWith: [],
    provenance: { source: input.source ?? "manual", capturedAt: now, confidence: input.aiDraft ? 0.7 : 1 },
    createdAt: now,
    updatedAt: now,
  });
  await ref.set(memory);
  return memory;
}

export async function getOwnedMemory(id: string, ownerId: string): Promise<MemoryObject> {
  const snap = await memories().doc(id).get();
  const m = snap.exists ? fromFirestore<MemoryObject>(snap.data()!) : null;
  if (!m || m.ownerId !== ownerId) throw new ConsentError("Memory not found", 404);
  return m;
}

export async function reviewMemory(id: string, ownerId: string, finalText: string): Promise<MemoryObject> {
  const m = await getOwnedMemory(id, ownerId);
  const updated = { ...m, text: finalText, aiDraft: null, reviewState: "reviewed" as const, updatedAt: new Date() };
  await memories().doc(id).set(updated);
  return updated;
}

// Explicit share action. Only people in an accepted connection with the owner can receive it.
export async function shareMemory(id: string, ownerId: string, withMemberId: string): Promise<MemoryObject> {
  const m = await getOwnedMemory(id, ownerId);
  if (!m.connectionId) throw new ConsentError("Only memories attached to a connection can be shared", 400);
  const conn = await getConnectionFor(m.connectionId, ownerId);
  if (conn.status !== "accepted" || otherMember(conn, ownerId) !== withMemberId) {
    throw new ConsentError("Can only share with the accepted connection this memory is about");
  }
  const updated = { ...m, sharedWith: [...new Set([...m.sharedWith, withMemberId])], updatedAt: new Date() };
  await memories().doc(id).set(updated);
  return updated;
}

export async function listMemories(ownerId: string, connectionId?: string): Promise<MemoryObject[]> {
  let q = memories().where("ownerId", "==", ownerId);
  if (connectionId) q = q.where("connectionId", "==", connectionId);
  const snap = await q.get();
  return snap.docs.map((d) => fromFirestore<MemoryObject>(d.data()));
}

// Deleting a memory also deletes its private media.
export async function deleteMemory(id: string, ownerId: string): Promise<void> {
  const m = await getOwnedMemory(id, ownerId);
  if (m.storagePath) await deleteObject(m.storagePath);
  await memories().doc(id).delete();
}

export async function createFollowUp(
  ownerId: string,
  input: { connectionId: string; reason: string; dueAt: Date; sourceMemoryId?: string | null },
): Promise<FollowUp> {
  const conn = await getConnectionFor(input.connectionId, ownerId);
  if (conn.status !== "accepted") throw new ConsentError("Follow-ups need an accepted connection", 409);
  const now = new Date();
  const ref = followUps().doc();
  const fu = FollowUp.parse({
    id: ref.id,
    ownerId,
    connectionId: input.connectionId,
    reason: input.reason,
    dueAt: input.dueAt,
    status: "open",
    draft: null,
    whyNow: null,
    sourceMemoryId: input.sourceMemoryId ?? null,
    promptedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  await ref.set(fu);
  return fu;
}

export async function listFollowUps(ownerId: string): Promise<FollowUp[]> {
  const snap = await followUps().where("ownerId", "==", ownerId).get();
  return snap.docs.map((d) => fromFirestore<FollowUp>(d.data()));
}

export async function setFollowUpStatus(
  id: string,
  ownerId: string,
  status: "sent" | "done" | "dismissed",
): Promise<FollowUp> {
  const snap = await followUps().doc(id).get();
  const fu = snap.exists ? fromFirestore<FollowUp>(snap.data()!) : null;
  if (!fu || fu.ownerId !== ownerId) throw new ConsentError("Follow-up not found", 404);
  const updated = { ...fu, status, updatedAt: new Date() };
  await followUps().doc(id).set(updated);
  return updated;
}

// Called by the Pub/Sub-triggered job: mark due follow-ups as prompted. `now` is injectable for the demo fast-forward.
// Drafting the message with Gemini happens in the AI layer after this returns.
export async function promptDueFollowUps(now = new Date()): Promise<FollowUp[]> {
  const snap = await followUps().where("status", "==", "open").where("dueAt", "<=", now).get();
  const batch = getDb().batch();
  const due = snap.docs.map((d) => {
    const fu = fromFirestore<FollowUp>(d.data());
    const updated = { ...fu, status: "prompted" as const, promptedAt: now, updatedAt: now };
    batch.set(d.ref, updated);
    return updated;
  });
  await batch.commit();
  return due;
}

export async function saveMemory(m: MemoryObject): Promise<void> {
  await memories().doc(m.id).set(m);
}

export async function getOwnedFollowUp(id: string, ownerId: string): Promise<FollowUp> {
  const snap = await followUps().doc(id).get();
  const fu = snap.exists ? fromFirestore<FollowUp>(snap.data()!) : null;
  if (!fu || fu.ownerId !== ownerId) throw new ConsentError("Follow-up not found", 404);
  return fu;
}

export async function saveFollowUp(fu: FollowUp): Promise<void> {
  await followUps().doc(fu.id).set(fu);
}
