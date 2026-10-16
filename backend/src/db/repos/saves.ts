// Saved people: private to their owner, scoped to one event.
import { getDb, fromFirestore } from "../firestore.js";
import { COLLECTIONS, Save } from "../schema.js";

const col = () => getDb().collection(COLLECTIONS.saves);
const saveId = (ownerId: string, eventId: string, memberId: string) => `${ownerId}__${eventId}__${memberId}`;

export async function savePerson(ownerId: string, eventId: string, memberId: string, reason: string | null): Promise<Save> {
  const save = Save.parse({ id: saveId(ownerId, eventId, memberId), ownerId, eventId, memberId, reason, createdAt: new Date() });
  await col().doc(save.id).set(save);
  return save;
}

export async function unsavePerson(ownerId: string, eventId: string, memberId: string): Promise<void> {
  await col().doc(saveId(ownerId, eventId, memberId)).delete();
}

export async function listSaves(ownerId: string, eventId: string): Promise<Save[]> {
  const snap = await col().where("ownerId", "==", ownerId).where("eventId", "==", eventId).get();
  return snap.docs.map((d) => fromFirestore<Save>(d.data()));
}
