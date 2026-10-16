import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Header from "../../layout/Header";
import Alert from "../../ui/Alert";
import Block from "../../ui/Block";
import Button from "../../ui/Button";
import MatchCard from "../../ui/MatchCard";
import ShareSheet from "../../ui/ShareSheet";
import { Api, type Match } from "../../lib/api";
import { useMe } from "../../lib/me";
import { useLoad } from "../../lib/useLoad";
import { firstName } from "../../lib/people";

// "See who to meet": suggestions for one event. Only people who are going and opted in, and only if you did too.
export default function People() {
  const { eventId = "" } = useParams();
  const { me } = useMe();
  const event = useLoad(() => Api.event(eventId), [eventId]);
  const { data, error, reload } = useLoad(() => Api.matches(eventId), [eventId]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [asking, setAsking] = useState<Match | null>(null);

  const back = (
    <Link to={`/events/${eventId}`} className="pd-btn pd-btn--ghost pd-btn--icon k-back" aria-label="Back to event">
      <ArrowLeft className="pd-i" aria-hidden="true" />
    </Link>
  );
  const list = (data?.matches ?? []).filter((m) => !dismissed.has(m.memberId));
  const title = event.data?.event.title;

  return (
    <>
      <Header title="Who to meet" back={back} />
      <div className="pd-page k-stack">
        {title && (
          <div>
            <h2 className="title">{title}</h2>
            <p className="k-muted" style={{ marginTop: "var(--space-2)" }}>
              People going who also chose to be found. Nothing is sent until you tap Request.
            </p>
          </div>
        )}

        {error?.status === 403 && (
          <Alert tone="privacy" title="Turn on Visible to matches first" action={<Link to={`/events/${eventId}`} className="pd-btn pd-btn--outline pd-btn--sm">Open event</Link>}>
            Matching works both ways: you see people who can also see you.
          </Alert>
        )}
        {error && error.status !== 403 && (
          <Alert tone="destructive" title="Klick couldn't load suggestions" action={<Button variant="outline" size="sm" onClick={reload}>Retry</Button>}>
            Check your connection and try again.
          </Alert>
        )}
        {!data && !error && <div className="k-spinner">Finding people worth meeting…</div>}

        {data && !data.ai && list.length > 0 && (
          <Alert title="Suggestions from shared interests">The AI explanation is unavailable right now, so these are based on what you have in common.</Alert>
        )}

        {data && list.length > 0 && (
          <div className="pd-cards k-match-grid">
            {list.map((m) => (
              <MatchCard
                key={m.memberId}
                match={m}
                sent={sent.has(m.memberId)}
                readAloud={!!me?.accessibility.readAloud}
                onRequest={() => setAsking(m)}
                onDismiss={() => setDismissed((s) => new Set(s).add(m.memberId))}
              />
            ))}
          </div>
        )}

        {data && list.length === 0 && (
          <div className="k-empty">
            <Block studs={4} unit={14} />
            <h2>No suggestions yet</h2>
            <p>As more people going turn on Visible to matches, they'll show up here. Check back closer to the event.</p>
          </div>
        )}
      </div>

      {asking && (
        <ShareSheet
          title={`Request a Klick with ${firstName(asking.profile?.displayName ?? "them")}`}
          description="Choose what they see if they accept. Until then they only see your name, role and note."
          cta={(n) => (n ? `Send request and share ${n} field${n === 1 ? "" : "s"}` : "Send request")}
          withNote
          onClose={() => setAsking(null)}
          onSubmit={async (fields, note) => {
            await Api.requestKlick({ to: asking.memberId, eventId, context: note, shareFields: fields });
            setSent((s) => new Set(s).add(asking.memberId));
            setAsking(null);
          }}
        />
      )}
    </>
  );
}
