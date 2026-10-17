import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { Api, ApiError } from "../../lib/api";
import { auth } from "../../lib/firebase";
import { useMe } from "../../lib/me";
import Button from "../../ui/Button";
import Steps from "./Steps";

// Accepts "diya-k", "linkedin.com/in/diya-k" or a full profile URL, and keeps just the username.
function linkedinUsername(input: string): string {
  const s = input.trim();
  const m = /linkedin\.com\/in\/([^/?#\s]+)/i.exec(s);
  return (m ? m[1] : s.replace(/^@/, "")).replace(/\/+$/, "");
}
const VALID = /^[A-Za-z0-9-]{3,100}$/;

// Step 1: the email is already verified by Google sign-in, so we only ask for the member's LinkedIn username.
export default function Identity() {
  const { setMe } = useMe();
  const user = auth.currentUser;
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState<"save" | "skip" | null>(null);
  const [error, setError] = useState("");
  const username = linkedinUsername(value);
  const invalid = value.trim() !== "" && !VALID.test(username);

  async function save() {
    if (!VALID.test(username)) return setError("Use the part after linkedin.com/in/, for example diya-karmakar.");
    setBusy("save");
    setError("");
    try {
      setMe(await Api.linkedinUsername(username));
    } catch (e) {
      setBusy(null);
      setError(e instanceof ApiError && e.status === 400 ? "That doesn't look like a LinkedIn username." : "Couldn't save that. Check your connection, then retry.");
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
        <h1 className="title">Add your LinkedIn</h1>
        <p className="k-muted" style={{ marginTop: "var(--space-3)" }}>
          People you Klick with can see it, but only if you choose to share it.
        </p>
        {user?.email && (
          <p className="k-verified">
            <CircleCheck className="pd-i" aria-hidden="true" />
            <span>
              {user.email}
              <small>{user.emailVerified ? "Verified by Google" : "Signed in with Google"}</small>
            </span>
          </p>
        )}
        <form
          className="pd-field"
          style={{ marginTop: "var(--space-6)" }}
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label htmlFor="li-username">LinkedIn username</label>
          <div className="k-prefix">
            <span aria-hidden="true">linkedin.com/in/</span>
            <input
              id="li-username"
              className="pd-input"
              value={value}
              placeholder="your-name"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={invalid}
              onChange={(e) => setValue(/linkedin\.com\/in\//i.test(e.target.value) ? linkedinUsername(e.target.value) : e.target.value)}
            />
          </div>
          <p className="pd-hint">You can paste your whole profile link too.</p>
        </form>
        <div className="k-flow__foot">
          {error && (
            <p className="pd-error" role="alert">
              {error}
            </p>
          )}
          <Button variant="primary" size="lg" loading={busy === "save"} disabled={!value.trim() || invalid || !!busy} onClick={save}>
            Continue
          </Button>
          <Button variant="ghost" loading={busy === "skip"} disabled={!!busy} onClick={skip}>
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  );
}
