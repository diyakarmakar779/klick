import { isSignInWithEmailLink, sendSignInLinkToEmail, signInWithEmailLink } from "firebase/auth";
import { auth } from "./firebase";

// Email sign-in: Firebase emails a one-time sign-in link (Firebase has no 6-digit email codes).
// The address is remembered on this device so opening the link here needs no retyping.
const KEY = "klick.emailForSignIn";

export async function sendEmailLink(email: string) {
  await sendSignInLinkToEmail(auth, email, { url: `${window.location.origin}/`, handleCodeInApp: true });
  try {
    localStorage.setItem(KEY, email);
  } catch {
    /* private mode: they'll be asked to confirm the address */
  }
}

export const openedEmailLink = () => isSignInWithEmailLink(auth, window.location.href);

export function rememberedEmail(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function finishEmailLink(email: string) {
  await signInWithEmailLink(auth, email, window.location.href);
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
  window.history.replaceState(null, "", "/");
}

// Plain words for the errors people actually hit.
export function emailError(e: unknown): string {
  const code = (e as { code?: string }).code ?? "";
  if (code === "auth/invalid-email") return "That email address doesn't look right.";
  if (code === "auth/operation-not-allowed") return "Email sign-in isn't switched on yet. Continue with Google for now.";
  if (code === "auth/quota-exceeded" || code === "auth/too-many-requests") return "Too many emails for now. Wait a few minutes, then try again.";
  if (code === "auth/invalid-action-code" || code === "auth/expired-action-code") return "That link has expired or was already used. Send a new one.";
  if (code === "auth/network-request-failed") return "No connection. Check it, then try again.";
  return "That didn't work. Try again.";
}
