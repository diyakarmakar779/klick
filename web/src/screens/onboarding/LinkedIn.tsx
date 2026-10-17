import { useState } from "react";
import { Info, Link2 } from "lucide-react";
import { Api, type Me } from "../../lib/api";
import Button from "../../ui/Button";
import KlickBadge from "../../ui/KlickBadge";
import Flow, { FlowError, useGo } from "./Flow";
import { myPhoto } from "./photo";

// Accepts "diya-k", "linkedin.com/in/diya-k" or a full profile URL, and keeps just the username.
function linkedinUsername(input: string): string {
  const s = input.trim();
  const m = /linkedin\.com\/in\/([^/?#\s]+)/i.exec(s);
  return (m ? m[1] : s.replace(/^@/, "")).replace(/\/+$/, "");
}
const VALID = /^[A-Za-z0-9-]{3,100}$/;

// Step 4: their Klick badge, and the LinkedIn link it carries. The link is self-reported and kept
// as a private contact detail; Klick never looks anyone up on LinkedIn.
export default function LinkedIn({ me }: { me: Me }) {
  const { go, busy, error, setError } = useGo();
  const [value, setValue] = useState(me.linkedinProfile ? `linkedin.com/in/${me.linkedinProfile.username}` : "");
  const username = linkedinUsername(value);
  const invalid = value.trim() !== "" && !VALID.test(username);

  function save() {
    if (!VALID.test(username)) return setError("Use your profile link, like linkedin.com/in/your-name.");
    return go("integrations", async () => {
      if (username.toLowerCase() !== me.linkedinProfile?.username) await Api.linkedinUsername(username);
    });
  }

  return (
    <Flow
      step={4}
      onBack={() => go("block")}
      title="Add your LinkedIn"
      sub="It goes on your Klick badge. People see it only if you share it after you both accept."
      foot={
        <>
          <FlowError>{error}</FlowError>
          <Button variant="primary" size="lg" loading={busy} disabled={!value.trim() || invalid || busy} onClick={save}>
            Continue
          </Button>
          <button type="button" className="k-onb__link" disabled={busy} onClick={() => go("integrations")}>
            Skip for now
          </button>
        </>
      }
    >
      <KlickBadge color={me.block?.color ?? "blue"} name={me.displayName === "New member" ? "Your name" : me.displayName} label="Klick member" photo={myPhoto(me)?.url}>
        <small>
          <Link2 className="pd-i" aria-hidden="true" style={{ width: 14, height: 14 }} />
          {VALID.test(username) ? `linkedin.com/in/${username.toLowerCase()}` : "Your LinkedIn goes here"}
        </small>
      </KlickBadge>
      <form
        className="k-onb__body"
        onSubmit={(e) => {
          e.preventDefault();
          save();
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
          <span className="pd-hint">You can paste your whole profile link.</span>
        </div>
        <p className="k-note">
          <Info className="pd-i" aria-hidden="true" />
          <span>Klick never posts to LinkedIn or messages anyone for you.</span>
        </p>
      </form>
    </Flow>
  );
}
