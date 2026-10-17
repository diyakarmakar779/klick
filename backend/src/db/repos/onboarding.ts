// Onboarding, once signed in with Google: verified email -> consent -> block -> LinkedIn -> event sources
// -> who you want to meet -> done.
import { getDb } from "../firestore.js";
import { COLLECTIONS, LinkedInIdentity, LinkedInProfile, Questionnaire, type Member, type OnboardingStep } from "../schema.js";
import { ConsentError } from "../../domain/consent.js";
import type { LinkedInUserInfo } from "../../lib/linkedin.js";
import { getMember } from "./members.js";

const doc = (id: string) => getDb().collection(COLLECTIONS.members).doc(id);

async function mustGet(id: string): Promise<Member> {
  const m = await getMember(id);
  if (!m) throw new ConsentError("Create your profile first", 404);
  return m;
}

// Store what LinkedIn returned as a candidate; nothing is applied until the member confirms.
export async function setLinkedInCandidate(memberId: string, info: LinkedInUserInfo, accountEmail: string | null) {
  await mustGet(memberId);
  const candidate = LinkedInIdentity.parse({
    sub: info.sub,
    name: info.name,
    pictureUrl: info.picture ?? null,
    email: info.email ?? null,
    emailVerified: info.email_verified ?? false,
    emailMatchesAccount: !!info.email && !!accountEmail && info.email.toLowerCase() === accountEmail.toLowerCase(),
    confirmedAt: null,
  });
  await doc(memberId).set({ linkedinCandidate: candidate, updatedAt: new Date() }, { merge: true });
  return candidate;
}

export async function confirmLinkedIn(memberId: string, isMe: boolean) {
  const m = await mustGet(memberId);
  if (!m.linkedinCandidate) throw new ConsentError("Nothing to confirm", 409);
  const now = new Date();
  const update: Partial<Member> = { linkedinCandidate: null, updatedAt: now };
  if (isMe) {
    update.linkedin = { ...m.linkedinCandidate, confirmedAt: now };
    if (!m.displayName || m.displayName === "New member") update.displayName = m.linkedinCandidate.name;
    update.onboarding = { step: "integrations", completedAt: null };
  }
  await doc(memberId).set(update, { merge: true });
  return mustGet(memberId);
}

// Step 1: the member types their LinkedIn username. Their email is already verified by Google sign-in.
// The link is kept as a private contact detail, shared only when they choose to on a Klick.
export async function setLinkedInUsername(memberId: string, username: string) {
  const m = await mustGet(memberId);
  const now = new Date();
  const slug = username.toLowerCase();
  const profile = LinkedInProfile.parse({ username: slug, url: `https://www.linkedin.com/in/${slug}`, source: "self_reported", addedAt: now });
  await doc(memberId).set(
    {
      linkedinProfile: profile,
      contact: { ...m.contact, linkedin: profile.url },
      updatedAt: now,
    },
    { merge: true },
  );
  return mustGet(memberId);
}

// Moves between onboarding steps, forward or back. "done" stamps the finish time.
export async function setOnboardingStep(memberId: string, step: OnboardingStep) {
  const m = await mustGet(memberId);
  const completedAt = step === "done" ? (m.onboarding.completedAt ?? new Date()) : null;
  await doc(memberId).set({ onboarding: { step, completedAt }, updatedAt: new Date() }, { merge: true });
  return mustGet(memberId);
}

export const skipIdentity = (memberId: string) => setOnboardingStep(memberId, "integrations");
export const finishIntegrations = (memberId: string) => setOnboardingStep(memberId, "questionnaire");

export async function saveQuestionnaire(memberId: string, input: Omit<Questionnaire, "updatedAt">) {
  await mustGet(memberId);
  const now = new Date();
  const q = Questionnaire.parse({ ...input, updatedAt: now });
  await doc(memberId).set({ questionnaire: q, onboarding: { step: "done", completedAt: now }, updatedAt: now }, { merge: true });
  return mustGet(memberId);
}
