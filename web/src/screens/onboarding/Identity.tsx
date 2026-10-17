import { useState } from "react";
import { Linkedin } from "lucide-react";
import { Api, ApiError } from "../../lib/api";
import { useMe } from "../../lib/me";
import { startRedirect } from "../../lib/sources";
import Button from "../../ui/Button";
import Steps from "./Steps";

// Step 1: "Sign in with LinkedIn" so people know it's really you. LinkedIn only gives name, photo and email.
export default function Identity() {
  const { setMe } = useMe();
  const [busy, setBusy] = useState<"linkedin" | "skip" | null>(null);
  const [error, setError] = useState("");

  async function linkedin() {
    setBusy("linkedin");
    setError("");
    try {
      await startRedirect("linkedin", "/");
    } catch (e) {
      setBusy(null);
      setError(e instanceof ApiError && e.status === 503 ? "LinkedIn sign-in isn't set up yet. Skip for now." : "Couldn't reach LinkedIn. Check your connection, then retry.");
    }
  }

  async function skip() {
    setBusy("skip");
    try {
      setMe(await Api.skipIdentity());
    } catch {
      setBusy(null);
      setError("Couldn't save that. Check your connection, then retry.");
    }
  }

  return (
    <div className="k-flow">
      <div className="pd-page pd-page--narrow">
        <Steps step={1} />
        <h1 className="title">Show people it's really you</h1>
        <p className="k-muted" style={{ marginTop: "var(--space-3)" }}>
          Sign in with LinkedIn and we'll ask "Is this you?" before anything is saved. LinkedIn only shares your name, photo and email, and we never post for you.
        </p>
        <div className="k-flow__foot">
          {error && (
            <p className="pd-error" role="alert">
              {error}
            </p>
          )}
          <Button variant="primary" size="lg" loading={busy === "linkedin"} onClick={linkedin}>
            <Linkedin className="pd-i" aria-hidden="true" />
            Sign in with LinkedIn
          </Button>
          <Button variant="ghost" loading={busy === "skip"} onClick={skip}>
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  );
}
