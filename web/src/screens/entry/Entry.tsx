import { useEffect, useState, type FormEvent } from "react";
import { signInWithPopup } from "firebase/auth";
import { Info, Mail, UserRound } from "lucide-react";
import { auth, googleProvider } from "../../lib/firebase";
import { emailError, finishEmailLink, openedEmailLink, rememberedEmail, sendEmailLink } from "../../lib/emailLink";
import { FlatBrick } from "../../ui/Brick";
import Button from "../../ui/Button";
import Flow, { FlowError } from "../onboarding/Flow";

type Screen = "welcome" | "signup" | "signin" | "check" | "recover" | "confirm";
const RESEND = 30;

export function Logo() {
  return (
    <span className="k-logo">
      <FlatBrick color="blue" width={30} />
      Klick
    </span>
  );
}

// Signed out: welcome, create account or sign in (email link or Google), check your email, recover.
export default function Entry() {
  const [screen, setScreen] = useState<Screen>(() => (openedEmailLink() ? "confirm" : "welcome"));
  const [email, setEmail] = useState(() => rememberedEmail() ?? "");
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState("");
  const [wait, setWait] = useState(0);
  const [from, setFrom] = useState<Screen>("signup");

  // Opened the emailed link on the same device: finish signing in straight away.
  useEffect(() => {
    const known = rememberedEmail();
    if (screen === "confirm" && known) finishEmailLink(known).catch((e) => setError(emailError(e)));
    // Runs once, on the screen the page opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const show = (s: Screen) => {
    setError("");
    setScreen(s);
  };

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter your email address, like you@example.com.");
    setBusy("email");
    setError("");
    try {
      await sendEmailLink(email.trim());
      setFrom(screen === "check" ? from : screen);
      setScreen("check");
      setWait(RESEND);
    } catch (err) {
      setError(emailError(err));
    } finally {
      setBusy(null);
    }
  }

  async function google() {
    setBusy("google");
    setError("");
    try {
      await signInWithPopup(auth, googleProvider());
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "auth/popup-blocked") setError("Your browser blocked Google's window. Allow pop-ups for this site, then try again.");
      else if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") setError("Sign-in didn't finish. Check your connection, then try again.");
    } finally {
      setBusy(null);
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setBusy("email");
    setError("");
    try {
      await finishEmailLink(email.trim());
    } catch (err) {
      setBusy(null);
      setError(emailError(err));
    }
  }

  const emailField = (hint: string) => (
    <div className="pd-field">
      <label htmlFor="email">Email</label>
      <input
        id="email"
        className="pd-input"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        placeholder="you@example.com"
        onChange={(e) => {
          setEmail(e.target.value);
          setError("");
        }}
      />
      <span className="pd-hint">{hint}</span>
    </div>
  );

  if (screen === "welcome")
    return (
      <div className="k-flow k-onb">
        <div className="pd-page pd-page--narrow">
          <Logo />
          <div className="k-welcome__art" aria-hidden="true">
            <FlatBrick color="blue" width={120} />
            <div>
              <FlatBrick color="yellow" width={120} />
              <FlatBrick color="green" width={120} />
            </div>
            <FlatBrick color="red" width={120} />
          </div>
          <h1 className="display" style={{ marginTop: "auto" }}>
            Meet someone. Klick with intention.
          </h1>
          <p className="k-onb__sub">Build a relationship worth remembering. Klick keeps the people you meet at events, and why they mattered.</p>
          <div className="k-flow__foot" style={{ marginTop: 0, paddingTop: "var(--space-6)" }}>
            <Button variant="primary" size="lg" onClick={() => show("signup")}>
              Create account
            </Button>
            <Button variant="secondary" size="lg" onClick={() => show("signin")}>
              Sign in
            </Button>
            <p className="k-caption k-center">by Prod :D</p>
          </div>
        </div>
      </div>
    );

  if (screen === "signup" || screen === "signin") {
    const signup = screen === "signup";
    return (
      <Flow
        step={signup ? 1 : undefined}
        onBack={() => show("welcome")}
        title={signup ? "Create your account" : "Welcome back"}
        sub={signup ? "Use your email or Google. You review what's shared before anyone sees anything." : "Sign in with the email or Google account you used before."}
        foot={
          <>
            {signup && (
              <p className="k-caption k-center">
                By continuing you agree to the <a href="/privacy.html">Terms and Privacy policy</a>.
              </p>
            )}
            <p className="k-center" style={{ margin: 0, fontWeight: 600 }}>
              {signup ? "Already have an account? " : "New to Klick? "}
              <button type="button" className="k-onb__link" onClick={() => show(signup ? "signin" : "signup")}>
                {signup ? "Sign in" : "Create account"}
              </button>
            </p>
          </>
        }
      >
        <form className="k-onb__body" onSubmit={send} noValidate>
          {emailField("We'll email you a link to confirm it's you.")}
          <FlowError>{error}</FlowError>
          <Button type="submit" variant="primary" size="lg" loading={busy === "email"} disabled={!!busy}>
            Send link
          </Button>
          <div className="k-or">or</div>
          <Button type="button" variant="outline" size="lg" loading={busy === "google"} disabled={!!busy} onClick={google}>
            <UserRound className="pd-i" aria-hidden="true" />
            Continue with Google
          </Button>
          {!signup && (
            <button type="button" className="k-onb__link" onClick={() => show("recover")}>
              Can't access your account?
            </button>
          )}
        </form>
      </Flow>
    );
  }

  if (screen === "recover")
    return (
      <Flow
        onBack={() => show("signin")}
        title="Get back into Klick"
        sub="Enter the email on your account and we'll send a link to sign you in."
      >
        <form className="k-onb__body" onSubmit={send} noValidate>
          {emailField("The link works once and only on this address.")}
          <FlowError>{error}</FlowError>
          <Button type="submit" variant="primary" size="lg" loading={busy === "email"} disabled={!!busy}>
            Send link
          </Button>
          <p className="k-note">
            <Info className="pd-i" aria-hidden="true" />
            <span>Signed up with Google? Go back and use Continue with Google instead.</span>
          </p>
        </form>
      </Flow>
    );

  if (screen === "confirm")
    return (
      <Flow title="Confirm your email" sub="You opened the sign-in link on a different device or browser. Type the email it was sent to.">
        <form className="k-onb__body" onSubmit={confirm} noValidate>
          {emailField("This keeps someone else from using your link.")}
          <FlowError>{error}</FlowError>
          <Button type="submit" variant="primary" size="lg" loading={busy === "email"} disabled={!email.trim() || !!busy}>
            Sign in
          </Button>
          <button type="button" className="k-onb__link" onClick={() => show("welcome")}>
            Start again
          </button>
        </form>
      </Flow>
    );

  return (
    <Flow
      onBack={() => show(from)}
      title="Check your email"
      sub={
        <>
          We sent a sign-in link to <b style={{ color: "var(--foreground)" }}>{email.trim()}</b>. Open it on this device to continue.
        </>
      }
      foot={<p className="k-caption k-center">Can't find it? Check spam, or wait for the timer and send a new one.</p>}
    >
      <div className="k-mail" aria-hidden="true">
        <Mail className="pd-i" />
      </div>
      <div className="k-onb__body">
        <FlowError>{error}</FlowError>
        <Button variant="secondary" size="lg" loading={busy === "email"} disabled={wait > 0 || !!busy} onClick={() => send()}>
          {wait > 0 ? `Send a new link in 0:${String(wait).padStart(2, "0")}` : "Send a new link"}
        </Button>
        <button type="button" className="k-onb__link" onClick={() => show(from)}>
          Use a different email
        </button>
      </div>
    </Flow>
  );
}
