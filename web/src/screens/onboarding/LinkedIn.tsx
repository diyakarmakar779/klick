import { useState } from "react";
import { Info } from "lucide-react";
import { Api, ApiError, type Me } from "../../lib/api";
import { startRedirect } from "../../lib/sources";
import Button from "../../ui/Button";
import Flow, { FlowError, useGo } from "./Flow";

// Accepts "diya-k", "linkedin.com/in/diya-k" or a full profile URL, and keeps just the username.
function linkedinUsername(input: string): string {
  const s = input.trim();
  const m = /linkedin\.com\/in\/([^/?#\s]+)/i.exec(s);
  return (m ? m[1] : s.replace(/^@/, "")).replace(/\/+$/, "");
}
const VALID = /^[A-Za-z0-9-]{3,100}$/;

// Step 4: their LinkedIn link, kept as a private contact detail. "Find my profile" is LinkedIn's own
// sign-in (name, photo, email), shown back as "Is this you?". Klick never reads LinkedIn pages.
export default function LinkedIn({ me }: { me: Me }) {
  const { go, busy: moving, error, setError } = useGo();
  const [value, setValue] = useState(me.linkedinProfile ? `linkedin.com/in/${me.linkedinProfile.username}` : "");
  const [busy, setBusy] = useState<"find" | "manual" | null>(null);
  const username = linkedinUsername(value);
  const invalid = value.trim() !== "" && !VALID.test(username);

  async function saveLink() {
    if (value.trim() && username !== me.linkedinProfile?.username) await Api.linkedinUsername(username);
  }

  async function find() {
    if (invalid) return setError("Use your profile link, like linkedin.com/in/your-name.");
    setBusy("find");
    setError("");
    try {
      await saveLink();
      await startRedirect("linkedin", "/");
    } catch (e) {
      setBusy(null);
      setError(
        e instanceof ApiError && e.status === 503
          ? "LinkedIn sign-in isn't available right now. Enter your details instead."
          : "Couldn't reach LinkedIn. Check your connection, then retry.",
      );
    }
  }

  async function manual() {
    if (invalid) return setError("Use your profile link, like linkedin.com/in/your-name, or clear the box.");
    setBusy("manual");
    await go("profile", saveLink);
    setBusy(null);
  }

  return (
    <Flow
      step={4}
      onBack={() => go("block")}
      title="Start from your LinkedIn"
      sub="Paste your profile link, then confirm with LinkedIn and we'll suggest your name and photo. You review everything before it's saved."
      foot={
        <p className="k-note">
          <Info className="pd-i" aria-hidden="true" />
          <span>Klick never posts to LinkedIn or messages anyone for you.</span>
        </p>
      }
    >
      <form
        className="k-onb__body"
        onSubmit={(e) => {
          e.preventDefault();
          find();
        }}
      >
        <div className="pd-field">
          <label htmlFor="li">LinkedIn profile link</label>
          <input
            id="li"
            className="pd-input"
            value={value}
            placeholder="linkedin.com/in/your-name"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={invalid}
            onChange={(e) => {
              setValue(e.target.value);
              setError("");
            }}
          />
          <span className="pd-hint">Kept private. People see it only if you share it after a Klick.</span>
        </div>
        <FlowError>{error}</FlowError>
        <Button type="submit" variant="primary" size="lg" loading={busy === "find"} disabled={!!busy || moving}>
          Find my profile
        </Button>
        <button type="button" className="k-onb__link" disabled={!!busy || moving} onClick={manual}>
          Enter my details manually
        </button>
      </form>
    </Flow>
  );
}
