import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { LogOut, Wrench } from "lucide-react";
import { auth } from "../lib/firebase";
import Header from "../layout/Header";
import Button from "../ui/Button";

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export default function Profile() {
  const u = auth.currentUser;
  const name = u?.displayName ?? "You";
  return (
    <>
      <Header title="Profile" />
      <div className="pd-page pd-page--narrow">
        <div className="pd-person" style={{ marginTop: "var(--space-4)" }}>
          <span className="pd-avatar pd-avatar--lg">
            {u?.photoURL ? <img src={u.photoURL} alt={name} referrerPolicy="no-referrer" /> : initials(name)}
          </span>
          <div>
            <h4>{name}</h4>
            <p>{u?.email}</p>
          </div>
        </div>
        <div className="k-section pd-stack">
          <Link to="/dev" className="pd-btn pd-btn--outline">
            <Wrench className="pd-i" aria-hidden="true" />
            Test panel
          </Link>
          <Button variant="ghost" onClick={() => signOut(auth)}>
            <LogOut className="pd-i" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </div>
    </>
  );
}
