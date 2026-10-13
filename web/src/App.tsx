import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, type User } from "firebase/auth";
import { auth, googleProvider } from "./lib/firebase";
import { Api, ApiError } from "./lib/api";

// Phase 0 gate: sign in with Google and call a protected API route. Real screens replace this.
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  async function connectCalendar() {
    const res = await signInWithPopup(auth, googleProvider(true));
    const token = GoogleAuthProvider.credentialFromResult(res)?.accessToken;
    if (!token) return setStatus("Calendar access was not granted.");
    const { imported } = await Api.syncCalendar(token);
    setStatus(`Imported ${imported} events.`);
  }

  async function checkApi() {
    try {
      await Api.saveMe({ displayName: user?.displayName ?? "New member" });
      const me = await Api.me();
      setStatus(`API OK. Signed in as ${String(me.displayName)}.`);
    } catch (e) {
      setStatus(e instanceof ApiError ? `API error ${e.status}: ${e.message}` : String(e));
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>Connected Event Networking</h1>
      {!user ? (
        <button onClick={() => signInWithPopup(auth, googleProvider())}>Sign in with Google</button>
      ) : (
        <>
          <p>Hi {user.displayName}</p>
          <button onClick={checkApi}>Check API</button> <button onClick={connectCalendar}>Connect Google Calendar</button>{" "}
          <button onClick={() => signOut(auth)}>Sign out</button>
        </>
      )}
      <p role="status" aria-live="polite">{status}</p>
    </main>
  );
}
