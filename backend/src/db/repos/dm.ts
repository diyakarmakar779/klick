// Direct messages between two members whose Klick is accepted. Each member writes and sends their own messages.
import { getDb, fromFirestore } from "../firestore.js";
import { COLLECTIONS, DirectMessage, DmThread, type Connection } from "../schema.js";
import { ConsentError, otherMember } from "../../domain/consent.js";
import { getConnectionFor } from "./connections.js";

const col = () => getDb().collection(COLLECTIONS.dmThreads);

async function getThread(id: string): Promise<DmThread | null> {
  const snap = await col().doc(id).get();
  return snap.exists ? fromFirestore<DmThread>(snap.data()!) : null;
}

export async function sendDirectMessage(connectionId: string, from: string, text: string): Promise<DirectMessage> {
  const conn = await getConnectionFor(connectionId, from);
  if (conn.status !== "accepted") throw new ConsentError("You can message someone only while your Klick is active", 409);
  const now = new Date();
  const ref = col().doc(conn.id).collection("messages").doc();
  const msg = DirectMessage.parse({ id: ref.id, from, text: text.trim(), createdAt: now });
  const thread = (await getThread(conn.id)) ?? DmThread.parse({ id: conn.id, memberIds: conn.memberIds, last: null });
  await getDb()
    .batch()
    .set(ref, msg)
    .set(col().doc(conn.id), { ...thread, last: { from, text: msg.text.slice(0, 200), at: now }, readAt: { ...thread.readAt, [from]: now } })
    .commit();
  return msg;
}

// Opening a thread marks it read. The history stays readable after a Klick ends, but nothing new can be sent.
export async function openDirectThread(connectionId: string, memberId: string) {
  const conn = await getConnectionFor(connectionId, memberId);
  if (conn.status !== "accepted" && conn.status !== "revoked") throw new ConsentError("Not found", 404);
  const snap = await col().doc(conn.id).collection("messages").orderBy("createdAt").limitToLast(200).get();
  const messages = snap.docs.map((d) => fromFirestore<DirectMessage>(d.data()));
  if (snap.size) await col().doc(conn.id).set({ readAt: { [memberId]: new Date() } }, { merge: true });
  return { conn, messages, canSend: conn.status === "accepted" };
}

// Threads with at least one message, for the Chats list, with an unread count per thread.
export async function listDirectThreads(memberId: string, conns: Connection[]) {
  const ids = conns.filter((c) => c.status === "accepted").map((c) => c.id);
  const threads = (await Promise.all(ids.map(getThread))).filter((t): t is DmThread => !!t && !!t.last);
  return Promise.all(
    threads.map(async (t) => {
      const since = t.readAt[memberId] ?? new Date(0);
      const unread = (await col().doc(t.id).collection("messages").where("createdAt", ">", since).limit(20).get()).docs.filter(
        (d) => d.get("from") !== memberId,
      ).length;
      const conn = conns.find((c) => c.id === t.id)!;
      return { thread: t, otherId: otherMember(conn, memberId), unread };
    }),
  );
}
