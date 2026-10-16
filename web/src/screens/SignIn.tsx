import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import Block from "../ui/Block";
import Button from "../ui/Button";

export default function SignIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    setBusy(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider());
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "auth/popup-closed-by-user") setError("Sign-in didn't finish. Check your connection, then try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="k-flow">
      <div className="pd-page pd-page--narrow">
        <Block studs={4} unit={22} />
        <h1 className="display" style={{ marginTop: "var(--space-8)" }}>
          Meet someone. Klick with intention.
        </h1>
        <p className="subheading k-muted" style={{ marginTop: "var(--space-4)", fontWeight: 500 }}>
          Find the right people at events you're already going to, and remember why you met.
        </p>
        <div className="k-flow__foot">
          {error && (
            <p className="pd-error" role="alert">
              {error}
            </p>
          )}
          <Button variant="primary" size="lg" loading={busy} onClick={signIn}>
            Continue with Google
          </Button>
          <p className="k-caption" style={{ textAlign: "center" }}>
            We only read events you're part of, and nobody sees you until you choose.{" "}
            <a href="/privacy.html">Privacy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
