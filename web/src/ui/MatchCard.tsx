import { Check, Sparkles, Volume2, X } from "lucide-react";
import type { Match } from "../lib/api";
import { initials, roleLine, speak } from "../lib/people";
import Button from "./Button";

// A suggested person with the reason in plain words. Never a score.
export default function MatchCard({
  match,
  sent,
  readAloud,
  onRequest,
  onDismiss,
}: {
  match: Match;
  sent: boolean;
  readAloud: boolean;
  onRequest: () => void;
  onDismiss: () => void;
}) {
  const p = match.profile;
  const name = p?.displayName ?? "Someone at this event";
  return (
    <article className="pd-card">
      <div className="pd-person">
        <span className="pd-avatar pd-avatar--brand">{initials(name)}</span>
        <div className="k-grow">
          <h4>{name}</h4>
          {p && roleLine(p) && <p>{roleLine(p)}</p>}
        </div>
        {readAloud && (
          <button type="button" className="pd-btn pd-btn--ghost pd-btn--icon" aria-label={`Read why ${name} is a match`} onClick={() => speak(`${name}. ${match.reason} You could say: ${match.starter}`)}>
            <Volume2 className="pd-i" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="pd-why">
        <b>
          <Sparkles className="pd-i" aria-hidden="true" />
          Why this match
        </b>
        {match.reason}
      </div>
      {match.starter && (
        <p className="k-starter">
          <span>You could say</span>"{match.starter}"
        </p>
      )}
      <div className="pd-actions">
        {sent ? (
          <span className="pd-badge pd-badge--success">
            <Check className="pd-i" aria-hidden="true" />
            Request sent
          </span>
        ) : (
          <>
            <Button variant="brand" onClick={onRequest}>
              Request a Klick
            </Button>
            <Button variant="ghost" size="icon" aria-label={`Dismiss ${name}`} onClick={onDismiss}>
              <X className="pd-i" aria-hidden="true" />
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
