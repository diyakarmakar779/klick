import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { CalendarDays, Lock, Send, UserRound } from "lucide-react";
import { auth, googleProvider } from "../../lib/firebase";
import Brick, { FlatBrick } from "../../ui/Brick";
import Button from "../../ui/Button";
import Flow, { FlowError } from "../onboarding/Flow";
import klickLogo from "../../assets/klick-logo.png";

type Screen = "welcome" | "signup" | "signin";

export function Logo() {
  return (
    <span className="k-logo">
      <FlatBrick color="blue" width={30} />
      Klick
    </span>
  );
}

// Signed out: welcome, then create account or sign in. Google is the only sign-in for now.
export default function Entry() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const show = (s: Screen) => {
    setError("");
    setScreen(s);
  };

  async function google() {
    setBusy(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider());
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "auth/popup-blocked") setError("Your browser blocked Google's window. Allow pop-ups for this site, then try again.");
      else if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") setError("Sign-in didn't finish. Check your connection, then try again.");
    } finally {
      setBusy(false);
    }
  }

  if (screen === "welcome")
    return (
      <div className="k-flow k-onb">
        <div className="pd-page pd-page--narrow">
          <Logo />
          <img className="k-welcome__art" src={klickLogo} alt="Klick" width={240} height={240} />
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

  const signup = screen === "signup";
  return (
    <Flow
      onBack={() => show("welcome")}
      title={signup ? "Create your account" : "Welcome back"}
      sub={signup ? "Use your Google account. You review what's shared before anyone sees anything." : "Sign in with the Google account you used before."}
      foot={
        <>
          <FlowError>{error}</FlowError>
          <Button variant="primary" size="lg" loading={busy} onClick={google}>
            <UserRound className="pd-i" aria-hidden="true" />
            Continue with Google
          </Button>
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
      <div className="k-entry__art">
        <Brick color={signup ? "blue" : "green"} studs={signup ? 4 : 6} unit={44} />
        <ul className="k-entry__points">
          <li>
            <Lock className="pd-i" aria-hidden="true" />
            Nobody sees you until you choose
          </li>
          <li>
            <CalendarDays className="pd-i" aria-hidden="true" />
            Only events you're part of
          </li>
          <li>
            <Send className="pd-i" aria-hidden="true" />
            Nothing is sent for you
          </li>
        </ul>
      </div>
    </Flow>
  );
}
