import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { Api } from "./api";
import { auth, googleProvider } from "./firebase";

const RETURN_KEY = "klick.returnTo";

// Google Calendar: a one-time read-only token from a Google popup, sent once and never stored.
export async function connectCalendar(): Promise<{ imported: number; removed: number }> {
  const res = await signInWithPopup(auth, googleProvider(true));
  const token = GoogleAuthProvider.credentialFromResult(res)?.accessToken;
  if (!token) throw new Error("Calendar access wasn't granted. Tick the calendar box on Google's screen to continue.");
  return Api.syncCalendar(token);
}

// Redirect sign-ins (LinkedIn, Luma) come back to /connect/<provider>/callback; remember where to return.
export async function startRedirect(provider: "linkedin" | "luma", returnTo: string) {
  const redirectUri = `${window.location.origin}/connect/${provider}/callback`;
  const { url } = provider === "linkedin" ? await Api.linkedinStart(redirectUri) : await Api.lumaStart(redirectUri);
  try {
    sessionStorage.setItem(RETURN_KEY, returnTo);
  } catch {
    /* private mode: fall back to home */
  }
  window.location.assign(url);
}

export function takeReturnTo(): string {
  try {
    const v = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return v && v.startsWith("/") ? v : "/";
  } catch {
    return "/";
  }
}
