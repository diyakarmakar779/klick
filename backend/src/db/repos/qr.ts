// QR exchange. The code encodes only an opaque random token that expires; scanning it reveals the
// owner's public-before-connection profile and which contact fields exist, never their values.
import { randomBytes } from "node:crypto";
import { getDb, fromFirestore } from "../firestore.js";
import { COLLECTIONS, QrToken, type ContactField } from "../schema.js";
import { ConsentError } from "../../domain/consent.js";
import { getMember, publicProfile } from "./members.js";

const TTL_MS = 10 * 60 * 1000;
const col = () => getDb().collection(COLLECTIONS.qrTokens);

export async function createQrToken(memberId: string, eventId: string | null): Promise<QrToken> {
  const now = new Date();
  const token = QrToken.parse({
    id: randomBytes(18).toString("base64url"),
    memberId,
    eventId,
    expiresAt: new Date(now.getTime() + TTL_MS),
    createdAt: now,
  });
  await col().doc(token.id).set(token);
  return token;
}

export async function resolveQrToken(id: string): Promise<QrToken> {
  const snap = await col().doc(id).get();
  const token = snap.exists ? fromFirestore<QrToken>(snap.data()!) : null;
  if (!token || token.expiresAt.getTime() < Date.now()) throw new ConsentError("QR code expired or invalid", 410);
  return token;
}

// What the scanner sees before deciding to send a request.
export async function previewQr(id: string, scannerId: string) {
  const token = await resolveQrToken(id);
  if (token.memberId === scannerId) throw new ConsentError("That's your own code", 400);
  const owner = await getMember(token.memberId);
  if (!owner) throw new ConsentError("QR code expired or invalid", 410);
  return {
    profile: publicProfile(owner),
    eventId: token.eventId,
    availableContactFields: Object.keys(owner.contact) as ContactField[],
    autoAccepts: owner.connectionPreference === "auto_accept",
  };
}
