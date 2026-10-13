import { useEffect, useRef, useState } from "react";
import { Api, ApiError, type LinkedInCandidate } from "./lib/api";

const CALLBACK_PATH = "/connect/linkedin/callback";
const redirectUri = () => `${window.location.origin}${CALLBACK_PATH}`;

// "Sign in with LinkedIn", then "Is this you?". Nothing from LinkedIn is saved until the member says yes.
export default function LinkedInConnect({ onStatus }: { onStatus: (s: string) => void }) {
  const [candidate, setCandidate] = useState<LinkedInCandidate | null>(null);
  const handled = useRef(false);

  // Back from LinkedIn: finish the sign-in once, then clean the address bar.
  useEffect(() => {
    if (handled.current || window.location.pathname !== CALLBACK_PATH) return;
    handled.current = true;
    const q = new URLSearchParams(window.location.search);
    window.history.replaceState(null, "", "/");
    const code = q.get("code");
    const state = q.get("state");
    if (!code || !state) return onStatus(q.get("error") === "user_cancelled_login" ? "LinkedIn sign-in cancelled." : "LinkedIn sign-in didn't finish.");
    onStatus("Checking with LinkedIn…");
    Api.linkedinCallback(code, state)
      .then(({ candidate }) => {
        setCandidate(candidate);
        onStatus("");
      })
      .catch((e) => onStatus(e instanceof ApiError ? `LinkedIn failed (${e.status}): ${e.message}` : String(e)));
  }, [onStatus]);

  async function start() {
    try {
      const { url } = await Api.linkedinStart(redirectUri());
      window.location.assign(url);
    } catch (e) {
      onStatus(e instanceof ApiError ? `LinkedIn failed (${e.status}): ${e.message}` : String(e));
    }
  }

  async function answer(isMe: boolean) {
    setCandidate(null);
    try {
      const me = await Api.linkedinConfirm(isMe);
      onStatus(isMe ? `LinkedIn connected as ${String(me.displayName)}.` : "OK, nothing from LinkedIn was saved.");
    } catch (e) {
      onStatus(e instanceof ApiError ? `LinkedIn failed (${e.status}): ${e.message}` : String(e));
    }
  }

  if (candidate) {
    return (
      <div style={{ border: "1px solid #ccc", padding: 12, margin: "12px 0" }}>
        <p>
          <strong>Is this you?</strong>
        </p>
        {candidate.pictureUrl && <img src={candidate.pictureUrl} alt="" width={64} height={64} style={{ borderRadius: 32 }} />}
        <p>
          {candidate.name}
          {candidate.email && (
            <>
              <br />
              {candidate.email} {candidate.emailMatchesAccount ? "(same as your Google email)" : "(different from your Google email)"}
            </>
          )}
        </p>
        <button onClick={() => answer(true)}>Yes, that's me</button> <button onClick={() => answer(false)}>No</button>
      </div>
    );
  }
  return (
    <p>
      <button onClick={start}>Sign in with LinkedIn</button>
    </p>
  );
}
