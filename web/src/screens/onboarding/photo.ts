import type { Me } from "../../lib/api";
import { auth } from "../../lib/firebase";

// The member's photo comes from LinkedIn (once confirmed) or their Google account. There is no upload yet.
export function myPhoto(me: Me): { url: string; from: "LinkedIn" | "Google" } | null {
  if (me.linkedin?.pictureUrl) return { url: me.linkedin.pictureUrl, from: "LinkedIn" };
  const google = auth.currentUser?.photoURL;
  return google ? { url: google, from: "Google" } : null;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";
