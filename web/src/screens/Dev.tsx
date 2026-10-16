import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { Api, ApiError } from "../lib/api";
import Header from "../layout/Header";
import Button from "../ui/Button";
import TestPanel from "../TestPanel";

// The earlier test panel, kept for trying API calls until every screen is built.
export default function Dev() {
  const [status, setStatus] = useState("");

  async function connectCalendar() {
    const res = await signInWithPopup(auth, googleProvider(true));
    const token = GoogleAuthProvider.credentialFromResult(res)?.accessToken;
    if (!token) return setStatus("Calendar access was not granted.");
    const { imported, removed } = await Api.syncCalendar(token);
    setStatus(`Imported ${imported} events${removed ? `, removed ${removed} that aren't events` : ""}.`);
  }

  async function checkApi() {
    try {
      await Api.saveMe({ displayName: auth.currentUser?.displayName ?? "New member" });
      const me = await Api.me();
      setStatus(`API OK. Signed in as ${String(me.displayName)}.`);
    } catch (e) {
      setStatus(e instanceof ApiError ? `API error ${e.status}: ${e.message}` : String(e));
    }
  }

  return (
    <>
      <Header title="Test panel" />
      <div className="pd-page pd-page--narrow">
        <div className="pd-row" style={{ marginTop: "var(--space-4)" }}>
          <Button variant="outline" size="sm" onClick={checkApi}>
            Check API
          </Button>
          <Button variant="outline" size="sm" onClick={connectCalendar}>
            Connect Google Calendar
          </Button>
        </div>
        <p role="status" aria-live="polite" className="k-caption" style={{ marginTop: "var(--space-3)" }}>
          {status}
        </p>
        <TestPanel onStatus={setStatus} />
      </div>
    </>
  );
}
