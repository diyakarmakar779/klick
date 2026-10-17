import { CircleCheck } from "lucide-react";
import { signOut } from "firebase/auth";
import type { Me } from "../../lib/api";
import { auth } from "../../lib/firebase";
import Button from "../../ui/Button";
import Flow, { FlowError, useGo } from "./Flow";
import { initials, myPhoto } from "./photo";

// Step 1: the Google account they just signed in with. Google has already verified the email.
export default function Account({ me }: { me: Me }) {
  const { go, busy, error } = useGo();
  const user = auth.currentUser;
  const email = user?.email ?? me.contact.email ?? "";
  const photo = myPhoto(me);
  return (
    <Flow
      step={1}
      onBack={() => signOut(auth)}
      title="You're signed in"
      sub="This is the Google account Klick will use. Nobody else sees your email unless you share it after a Klick."
      foot={
        <>
          <FlowError>{error}</FlowError>
          <Button variant="primary" size="lg" loading={busy} onClick={() => go("consent")}>
            Continue
          </Button>
          <button type="button" className="k-onb__link" disabled={busy} onClick={() => signOut(auth)}>
            Use a different account
          </button>
        </>
      }
    >
      <div className="k-signedin">
        {photo ? <img src={photo.url} alt="" referrerPolicy="no-referrer" /> : <span className="pd-avatar pd-avatar--brand">{initials(me.displayName)}</span>}
        <b>{me.displayName}</b>
        {email && (
          <p className="k-signedin__email">
            <CircleCheck className="pd-i" aria-hidden="true" />
            <span>
              {email}
              <small>{user && !user.emailVerified ? "Signed in with Google" : "Verified by Google"}</small>
            </span>
          </p>
        )}
      </div>
    </Flow>
  );
}
