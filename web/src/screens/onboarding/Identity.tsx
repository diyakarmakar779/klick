import { useEffect, useRef, useState } from "react";
import { Linkedin } from "lucide-react";
import { Api, ApiError, type ProfileMatch } from "../../lib/api";
import { useMe } from "../../lib/me";
import { initials } from "../../lib/people";
import { startRedirect } from "../../lib/sources";
import Button from "../../ui/Button";
import Steps from "./Steps";

const shortUrl = (url: string) => url.replace(/^https:\/\/www\./, "");

// Step 1: "Is this you?" from a public web search for the Google name. If it's someone else, pick from the
// other results; if none fit, "Sign in with LinkedIn" (name, photo and email only) or skip.
export default function Identity() {
  const { setMe } = useMe();
  const [phase, setPhase] = useState<"searching" | "match" | "pick" | "signin">("searching");
  const [matches, setMatches] = useState<ProfileMatch[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState<"choose" | "linkedin" | "skip" | null>(null);
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    Api.linkedinMatches()
      .then(({ matches }) => {
        setMatches(matches);
        setPhase(matches.length ? "match" : "signin");
      })
      .catch(() => setPhase("signin")); // not set up or unreachable: signing in still works
  }, []);

  async function choose(m: ProfileMatch) {
    setBusy("choose");
    setError("");
    try {
      setMe(await Api.linkedinChoose(m));
    } catch {
      setBusy(null);
      setError("Couldn't save that. Check your connection, then retry.");
    }
  }

  function notMe() {
    setError("");
    setPhase(matches.length > 1 ? "pick" : "signin");
  }

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

  const errorLine = error && (
    <p className="pd-error" role="alert">
      {error}
    </p>
  );

  if (phase === "searching") {
    return (
      <div className="k-flow">
        <div className="pd-page pd-page--narrow">
          <Steps step={1} />
          <div className="k-spinner">Looking for your LinkedIn…</div>
        </div>
      </div>
    );
  }

  if (phase === "match") {
    const top = matches[0];
    return (
      <div className="k-flow">
        <div className="pd-page pd-page--narrow">
          <Steps step={1} />
          <h1 className="title">Is this you?</h1>
          <p className="k-muted" style={{ marginTop: "var(--space-3)" }}>
            We looked for public LinkedIn pages with your name. Nothing is saved until you say yes.
          </p>
          <div className="k-identity">
            <span className="pd-avatar pd-avatar--lg">{initials(top.name)}</span>
            <h2 className="heading">{top.name}</h2>
            {top.headline && <p>{top.headline}</p>}
            <a className="k-caption" href={top.url} target="_blank" rel="noopener noreferrer">
              {shortUrl(top.url)}
            </a>
            {top.snippet && <p className="k-caption">{top.snippet}</p>}
          </div>
          <div className="k-flow__foot">
            {errorLine}
            <Button variant="primary" size="lg" loading={busy === "choose"} onClick={() => choose(top)}>
              Yes, that's me
            </Button>
            <Button variant="ghost" disabled={!!busy} onClick={notMe}>
              No, that's not me
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "pick") {
    const others = matches.slice(1);
    const choice = others.find((m) => m.url === picked);
    return (
      <div className="k-flow">
        <div className="pd-page pd-page--narrow">
          <Steps step={1} />
          <h1 className="title">Which one is you?</h1>
          <p className="k-muted" style={{ marginTop: "var(--space-3)" }}>
            Other public LinkedIn pages with your name. Open one to check before you pick.
          </p>
          <div className="pd-stack k-picks" role="radiogroup" aria-label="LinkedIn profiles">
            {others.map((m) => (
              <label key={m.url} className="pd-check k-pick">
                <input type="radio" name="profile" checked={picked === m.url} onChange={() => setPicked(m.url)} />
                <span className="pd-avatar pd-avatar--sm">{initials(m.name)}</span>
                <span>
                  {m.name}
                  {m.headline && <small>{m.headline}</small>}
                  <a className="k-caption" href={m.url} target="_blank" rel="noopener noreferrer">
                    {shortUrl(m.url)}
                  </a>
                </span>
              </label>
            ))}
          </div>
          <div className="k-flow__foot">
            {errorLine}
            <Button variant="primary" size="lg" disabled={!choice || !!busy} loading={busy === "choose"} onClick={() => choice && choose(choice)}>
              That's me
            </Button>
            <Button variant="ghost" disabled={!!busy} onClick={() => setPhase("signin")}>
              None of these
            </Button>
          </div>
        </div>
      </div>
    );
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
          {errorLine}
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
