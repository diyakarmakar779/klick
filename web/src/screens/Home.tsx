import { Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import Header from "../layout/Header";
import Block from "../ui/Block";
import { auth } from "../lib/firebase";

export default function Home() {
  const first = auth.currentUser?.displayName?.split(" ")[0];
  return (
    <>
      <Header title="Home" />
      <div className="pd-page">
        <h2 className="title" style={{ marginTop: "var(--space-4)" }}>
          {first ? `Hi ${first}` : "Hi"}
        </h2>
        <p className="k-muted" style={{ marginTop: "var(--space-2)" }}>
          Your next events and the people worth meeting there will show up here.
        </p>
        <div className="k-empty">
          <Block studs={4} unit={14} />
          <h2>Nothing coming up yet</h2>
          <p>Connect Google Calendar or Luma and Klick will find the events you're part of.</p>
          <Link to="/events" className="pd-btn pd-btn--primary">
            <CalendarDays className="pd-i" aria-hidden="true" />
            Go to events
          </Link>
        </div>
      </div>
    </>
  );
}
