import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Api, ApiError, type LinkedInCandidate } from "../lib/api";
import { useMe } from "../lib/me";
import { takeReturnTo } from "../lib/sources";
import { Link2 } from "lucide-react";
import Button from "../ui/Button";
import Flow, { FlowError } from "./onboarding/Flow";

// Where LinkedIn and Luma send the member back. Finishes the sign-in once, then returns to where they started.
export default function Callback({ provider }: { provider: "linkedin" | "luma" }) {
  const navigate = useNavigate();
  const { me, setMe, refresh } = useMe();
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

  // "Is this you?" as the design's badge: what LinkedIn returned, nothing applied until they say yes.
  if (candidate) {
    const [first, ...rest] = candidate.name.split(" ");
    const onboarding = me?.onboarding.step !== "done";
    return (
      <Flow
        step={onboarding ? 4 : undefined}
        onBack={() => answer(false)}
        title="Is this you?"
        sub="This is the LinkedIn account you just confirmed. Check it before using any of it."
        foot={
          <>
            {error && <FlowError>{error}</FlowError>}
            <Button variant="primary" size="lg" loading={busy} onClick={() => answer(true)}>
              Yes, use these details
            </Button>
            <Button variant="secondary" size="lg" disabled={busy} onClick={() => answer(false)}>
              This isn't me
            </Button>
            <p className="k-caption k-center">You can edit every field on the next screen.</p>
          </>
        }
      >
        <div className={`k-badge k-brick--${me?.block?.color ?? "blue"}`}>
          <div className="k-badge__top" aria-hidden="true" />
          <div className="k-badge__band">
            <h2>
              {first}
              {rest.length > 0 && <span>{rest.join(" ")}</span>}
            </h2>
            {candidate.pictureUrl ? <img src={candidate.pictureUrl} alt="" referrerPolicy="no-referrer" /> : null}
          </div>
          <div className="k-badge__meta">
            {candidate.email && <b>{candidate.email}</b>}
            <span className="k-caption">{candidate.emailMatchesAccount ? "Same email as the account you signed in with" : "A different email from the one you signed in with"}</span>
            {me?.linkedinProfile && (
              <small>
                <Link2 className="pd-i" aria-hidden="true" style={{ width: 14, height: 14 }} />
                From linkedin.com/in/{me.linkedinProfile.username}
              </small>
            )}
          </div>
        </div>
        <p className="k-onb__sub" style={{ marginTop: "var(--space-5)" }}>
          If this is you, we'll use your name{candidate.pictureUrl ? " and photo" : ""} to fill in your profile. You add your role, company and location yourself.
        </p>
      </Flow>
    );
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
        ) : (
          <div className="k-spinner">{provider === "linkedin" ? "Checking with LinkedIn…" : "Reading your Luma events…"}</div>
        )}
      </div>
    </div>
  );
}
