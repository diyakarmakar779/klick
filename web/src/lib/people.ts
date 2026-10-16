import type { ContactField, PublicProfile } from "./api";

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const firstName = (name: string) => name.split(/\s+/)[0] || name;

// What a person allows before a Klick: role and company (or their headline).
export const roleLine = (p: PublicProfile) => [p.role, p.company].filter(Boolean).join(", ") || p.headline;

export const FIELD_LABEL: Record<ContactField, string> = {
  email: "Email",
  phone: "Phone",
  linkedin: "LinkedIn",
  website: "Website",
  x: "X",
};

export const FIELD_PLACEHOLDER: Record<ContactField, string> = {
  email: "you@example.com",
  phone: "+91 98765 43210",
  linkedin: "linkedin.com/in/you",
  website: "yoursite.com",
  x: "@you",
};

// Read-aloud for people who turned it on in onboarding. Uses the browser's own voice; nothing leaves the device.
export function speak(text: string) {
  if (!("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-IN";
  window.speechSynthesis.speak(u);
  return true;
}
