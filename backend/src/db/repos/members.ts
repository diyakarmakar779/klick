import { getDb, fromFirestore } from "../firestore.js";
import { COLLECTIONS, Member } from "../schema.js";

export const MemberInput = Member.pick({
  displayName: true,
  headline: true,
  role: true,
  company: true,
  bio: true,
  location: true,
  block: true,
  sharing: true,
  interests: true,
  goals: true,
  languages: true,
  accessibility: true,
  defaultVisibility: true,
  discoverability: true,
  contact: true,
  connectionPreference: true,
}).partial();
export type MemberInput = typeof MemberInput._type;

const col = () => getDb().collection(COLLECTIONS.members);

export async function getMember(id: string): Promise<Member | null> {
  const snap = await col().doc(id).get();
  return snap.exists ? fromFirestore<Member>(snap.data()!) : null;
}

export async function upsertMember(id: string, input: MemberInput): Promise<Member> {
  const now = new Date();
  const existing = await getMember(id);
  const member = Member.parse({
    ...(existing ?? { displayName: input.displayName ?? "New member", createdAt: now }),
    ...input,
    id,
    updatedAt: now,
  });
  await col().doc(id).set(member);
  return member;
}

// What another member sees: no contact details, embedding or accessibility settings.
// Role, company and location follow the member's sharing defaults, before a Klick or once both accepted.
export function publicProfile(m: Member, accepted = false) {
  const shown: readonly string[] = accepted ? m.sharing.afterAccept : m.sharing.beforeKlick;
  const work = shown.includes("role_company");
  return {
    id: m.id,
    displayName: m.displayName,
    headline: work ? m.headline : "",
    role: work ? m.role : "",
    company: work ? m.company : "",
    location: shown.includes("location") ? m.location : "",
    interests: m.interests,
    languages: m.languages,
  };
}

// Own profile minus server-only fields.
export function ownProfile(m: Member) {
  const { embedding: _e, ...rest } = m;
  return rest;
}
