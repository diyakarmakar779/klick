import { useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, BookmarkCheck, Check, Clock, Lock, MessageCircle, MoreHorizontal, Sparkles } from "lucide-react";
import type { CatchUp, Match, PublicProfile } from "../lib/api";
import { initials, roleLine } from "../lib/people";
import Button from "./Button";

const monthYear = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
const dayMonthYear = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// The reason someone is worth meeting, in plain words. Never a score.
export function ReasonLine({ text }: { text: string }) {
  return (
    <p className="k-reason">
      <Sparkles className="pd-i" aria-hidden="true" />
      {text}
    </p>
  );
}

// Worth meeting: a suggestion with its reason and the one action that matters.
export function RecommendedRow({
  match,
  sent,
  saved,
  onRequest,
  onToggleSave,
  onHide,
}: {
  match: Match;
  sent: boolean;
  saved: boolean;
  onRequest: () => void;
  onToggleSave: () => void;
  onHide?: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const p = match.profile;
  const name = p?.displayName ?? "Someone at this event";
  return (
    <article className="k-prow">
      <div className="k-prow__who">
        <span className="pd-avatar">{initials(name)}</span>
        <div className="k-grow">
          <h4>{name}</h4>
          {p && roleLine(p) && <p>{roleLine(p)}</p>}
        </div>
      </div>
      {match.reason && <ReasonLine text={match.reason} />}
      <div className="k-prow__actions">
        {sent ? (
          <span className="k-status k-status--went">
            <Check className="pd-i" aria-hidden="true" />
            Request sent
          </span>
        ) : (
          <>
            <Button variant="brand" className="k-grow" onClick={onRequest}>
              Request a Klick
            </Button>
            <Button variant="outline" aria-pressed={saved} onClick={onToggleSave}>
              {saved ? <BookmarkCheck className="pd-i" aria-hidden="true" /> : <Bookmark className="pd-i" aria-hidden="true" />}
              {saved ? "Saved" : "Save"}
            </Button>
            {onHide && (
            <div className="k-menu">
              <Button variant="outline" size="icon" aria-label={`More options for ${name}`} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
                <MoreHorizontal className="pd-i" aria-hidden="true" />
              </Button>
              {menu && (
                <div className="k-menu__list" role="menu">
                  <button type="button" role="menuitem" onClick={onHide}>
                    Not for me
                  </button>
                </div>
              )}
            </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}

// Catch up: one of your Klicks going, with your own private memory of how you met.
// `here` when the Klick was made at the event being shown.
export function ConnectedRow({ item, here = false }: { item: CatchUp; here?: boolean }) {
  const { profile, memory, met } = item;
  const name = profile.displayName;
  const metLine = here ? `Klicked here, ${dayMonthYear(met.at)}` : `Klicked ${met.eventTitle ? `at ${met.eventTitle}, ` : ""}${monthYear(met.at)}`;
  return (
    <article className="k-prow">
      <div className="k-prow__who">
        <Link to={`/klicks/${item.connectionId}`} className="k-prow__link">
          <span className="pd-avatar k-avatar--klicked">{initials(name)}</span>
          <div className="k-grow">
            <h4>{name}</h4>
            {roleLine(profile) && <p>{roleLine(profile)}</p>}
          </div>
        </Link>
        <Link to={`/klicks/${item.connectionId}`} className="pd-btn pd-btn--outline pd-btn--icon" aria-label={`Open your Klick with ${name}`}>
          <MessageCircle className="pd-i" aria-hidden="true" />
        </Link>
      </div>
      {memory && !memory.reviewed && (
        <span className="k-status k-status--pending k-self-start">
          <Clock className="pd-i" aria-hidden="true" />
          Needs review
        </span>
      )}
      <div className="k-prow__memory">
        {memory && (
          <>
            <span className="k-status k-status--private k-self-start">
              <Lock className="pd-i" aria-hidden="true" />
              Only you
            </span>
            <p>{memory.reviewed ? memory.text : `${memory.kind === "voice" ? "Voice note" : memory.kind === "photo" ? "Photo" : "Note"}. Not reviewed yet.`}</p>
          </>
        )}
        <small>{metLine}</small>
      </div>
    </article>
  );
}

// Also going: name and role only. No actions.
export function ViewOnlyRow({ person }: { person: Pick<PublicProfile, "displayName" | "role" | "company" | "headline"> }) {
  const line = [person.role, person.company].filter(Boolean).join(", ") || person.headline;
  return (
    <div className="k-prow--view">
      <span className="pd-avatar pd-avatar--sm">{initials(person.displayName)}</span>
      <div className="k-grow">
        <b>{person.displayName}</b>
        {line && <small>{line}</small>}
      </div>
    </div>
  );
}
