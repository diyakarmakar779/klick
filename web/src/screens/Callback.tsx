import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Api, ApiError, type LinkedInCandidate } from "../lib/api";
import { useMe } from "../lib/me";
import { takeReturnTo } from "../lib/sources";
import Button from "../ui/Button";

// Where LinkedIn and Luma send the member back. Finishes the sign-in once, then returns to where they started.
export default function Callback({ provider }: { provider: "linkedin" | "luma" }) {
  const navigate = useNavigate();
  const { setMe, refresh } = useMe();
  const [candidate, setCandidate] = useState<LinkedInCandidate | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const q = new URLSearchParams(window.location.search);
    const code = q.get("code");
    const state = q.get("state");
    if (!code || !state) {
      setError(q.get("error")?.includes("cancel") ? "Sign-in was cancelled." : "Sign-in didn't finish.");
      return;
    }
    if (provider === "linkedin") {
      Api.linkedinCallback(code, state)
        .then(({ candidate }) => setCandidate(candidate))
        .catch((e) => setError(e instanceof ApiError && e.status === 410 ? "That sign-in link expired." : "LinkedIn sign-in didn't finish."));
    } else {
      Api.lumaCallback(code, state)
        .then(async ({ imported }) => {
          await refresh();
          navigate(`${takeReturnTo()}?imported=${imported}`, { replace: true });
        })
        .catch(() => setError("Couldn't read your Luma events."));
    }
  }, [provider, navigate, refresh]);

  async function answer(isMe: boolean) {
    setBusy(true);
    try {
      setMe(await Api.linkedinConfirm(isMe));
      navigate(takeReturnTo(), { replace: true });
    } catch {
      setBusy(false);
      setError("Couldn't save your answer.");
    }
  }

  return (
    <div className="k-flow">
      <div className="pd-page pd-page--narrow">
        {error ? (
          <>
            <h1 className="title">{error}</h1>
            <p className="k-muted" style={{ marginTop: "var(--space-3)" }}>
              Nothing was saved. Go back and try again.
            </p>
            <div className="k-flow__foot">
              <Button variant="primary" size="lg" onClick={() => navigate(takeReturnTo(), { replace: true })}>
                Go back
              </Button>
            </div>
          </>
        ) : candidate ? (
          <>
            <h1 className="title">Is this you?</h1>
            <p className="k-muted" style={{ marginTop: "var(--space-3)" }}>
              Nothing from LinkedIn is saved until you say yes.
            </p>
            <div className="k-identity">
              {candidate.pictureUrl ? (
                <img src={candidate.pictureUrl} alt={candidate.name} referrerPolicy="no-referrer" />
              ) : (
                <span className="pd-avatar pd-avatar--lg">{candidate.name.slice(0, 1)}</span>
              )}
              <h2 className="heading">{candidate.name}</h2>
              {candidate.email && (
                <p className="k-caption">
                  {candidate.email}
                  <br />
                  {candidate.emailMatchesAccount ? "Same email as your Google account" : "Different from your Google email"}
                </p>
              )}
            </div>
            <div className="k-flow__foot">
              <Button variant="primary" size="lg" loading={busy} onClick={() => answer(true)}>
                Yes, that's me
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => answer(false)}>
                No, that's not me
              </Button>
            </div>
          </>
        ) : (
          <div className="k-spinner">{provider === "linkedin" ? "Checking with LinkedIn…" : "Reading your Luma events…"}</div>
        )}
      </div>
    </div>
  );
}
