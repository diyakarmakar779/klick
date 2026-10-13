// Short-lived OAuth state for provider sign-in (Luma). Holds the PKCE verifier server-side, bound to the member.
import { randomBytes } from "node:crypto";
import { getDb } from "../firestore.js";
import { COLLECTIONS } from "../schema.js";
import { ConsentError } from "../../domain/consent.js";

const TTL_MS = 10 * 60 * 1000;

export function newState(): string {
  return randomBytes(24).toString("base64url");
}

export async function saveOAuthState(state: string, data: { memberId: string; provider: string; codeVerifier: string; redirectUri: string }) {
  await getDb().collection(COLLECTIONS.oauthStates).doc(state).set({ ...data, expiresAt: new Date(Date.now() + TTL_MS) });
}

// One use only; must belong to the caller and not be expired.
export async function takeOAuthState(state: string, memberId: string, provider: string) {
  const ref = getDb().collection(COLLECTIONS.oauthStates).doc(state);
  const data = await getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    tx.delete(ref);
    return snap.data()!;
  });
  if (!data || data.memberId !== memberId || data.provider !== provider) throw new ConsentError("Sign-in link is invalid; start again", 400);
  if (data.expiresAt.toDate() < new Date()) throw new ConsentError("Sign-in link expired; start again", 410);
  return data as { codeVerifier: string; redirectUri: string };
}
