import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Values come from Firebase console > Project settings > Your apps (safe to ship to the browser).
export const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});
export const auth = getAuth(app);

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";

export function googleProvider(withCalendar = false) {
  const p = new GoogleAuthProvider();
  if (withCalendar) p.addScope(CALENDAR_SCOPE);
  return p;
}
