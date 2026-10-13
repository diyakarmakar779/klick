import { getDb, fromFirestore } from "../firestore.js";
import { COLLECTIONS, Member } from "../schema.js";

export const MemberInput = Member.pick({
  displayName: true,
  headline: true,
  role: true,
  company: true,
  bio: true,
  interests: true,
  goals: true,
  languages: true,
  accessibility: true,
  defaultVisibility: true,
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

// Public-before-connection view: no contact details, embedding or accessibility settings.
export function publicProfile(m: Member) {
  return {
    id: m.id,
    displayName: m.displayName,
    headline: m.headline,
    role: m.role,
    company: m.company,
    interests: m.interests,
    languages: m.languages,
  };
}

// Own profile minus server-only fields.
export function ownProfile(m: Member) {
  const { embedding: _e, ...rest } = m;
  return rest;
}
