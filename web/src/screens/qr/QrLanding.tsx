import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, ScanLine } from "lucide-react";
import Header from "../../layout/Header";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import KlickSuccess from "../../ui/KlickSuccess";
import ShareSheet from "../../ui/ShareSheet";
import { Api } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { FIELD_LABEL, firstName, initials, roleLine } from "../../lib/people";

const listJoin = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

// Where a scanned Klick code lands: who it is, and a request you choose to send.
export default function QrLanding() {
  const { token = "" } = useParams();
  const { data, error } = useLoad(() => Api.previewQr(token), [token]);
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState<{ id: string; accepted: boolean; shared: string } | null>(null);

  const name = data ? firstName(data.profile.displayName) : "";

  return (
    <>
      <Header title="Klick" />
      <div className="pd-page pd-page--narrow k-stack">
        {error && (
          <Alert
            tone={error.status === 400 ? "info" : "warning"}
            title={error.status === 400 ? "That's your own code" : "This code has expired"}
            action={
              <Link to={error.status === 400 ? "/profile?qr=1" : "/scan"} className="pd-btn pd-btn--outline pd-btn--sm">
                <ScanLine className="pd-i" aria-hidden="true" />
                {error.status === 400 ? "My QR" : "Scan again"}
              </Link>
            }
          >
            {error.status === 400 ? "Show it to someone else so they can scan it." : "Codes refresh every few minutes. Ask them to show theirs again."}
          </Alert>
        )}
        {!data && !error && <div className="k-spinner">Loading…</div>}

        {data && done && (
          <KlickSuccess
            name={name}
            detail={done.accepted ? `${data.event ? `${data.event.title}. ` : ""}You shared: ${done.shared}.` : `Request sent. ${name} decides what to share, and you'll see it in Klicks.`}
          >
            {done.accepted ? (
              <Link to={`/klicks/${done.id}`} className="pd-btn pd-btn--primary">
                Add a memory
              </Link>
            ) : (
              <Link to="/klicks" className="pd-btn pd-btn--primary">
                Go to Klicks
              </Link>
            )}
          </KlickSuccess>
        )}

        {data && !done && (
          <article className="pd-card">
            <div className="pd-person">
              <span className="pd-avatar pd-avatar--lg pd-avatar--brand">{initials(data.profile.displayName)}</span>
              <div>
                <h4>{data.profile.displayName}</h4>
                {roleLine(data.profile) && <p>{roleLine(data.profile)}</p>}
              </div>
            </div>
            {data.event && (
              <p className="k-meta k-muted" style={{ marginTop: "var(--space-3)", fontSize: 13 }}>
                <CalendarDays className="pd-i" aria-hidden="true" />
                You're both at {data.event.title}
              </p>
            )}
            <p className="k-muted" style={{ marginTop: "var(--space-3)", fontSize: 13.5 }}>
              {data.availableContactFields.length
                ? `${name} can choose to share their ${listJoin(data.availableContactFields.map((f) => (f === "email" || f === "phone" || f === "website" ? FIELD_LABEL[f].toLowerCase() : FIELD_LABEL[f])))} once you both accept.`
                : `${name} hasn't added contact details yet. You'll still be connected in Klick.`}
            </p>
            <div className="pd-actions">
              <Button variant="brand" size="lg" className="k-full" onClick={() => setAsking(true)}>
                Request a Klick
              </Button>
            </div>
          </article>
        )}
      </div>

      {asking && data && (
        <ShareSheet
          title={`Request a Klick with ${name}`}
          description="Choose what they see if they accept."
          cta={(n) => (n ? `Send request and share ${n} field${n === 1 ? "" : "s"}` : "Send request")}
          withNote
          onClose={() => setAsking(false)}
          onSubmit={async (fields, note) => {
            const conn = await Api.requestByQr(token, fields, note);
            setDone({ id: conn.id, accepted: conn.status === "accepted", shared: ["name", ...fields.map((f) => FIELD_LABEL[f].toLowerCase())].join(", ") });
            setAsking(false);
          }}
        />
      )}
    </>
  );
}
