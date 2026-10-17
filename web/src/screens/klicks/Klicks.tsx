import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import Header from "../../layout/Header";
import Alert from "../../ui/Alert";
import Block from "../../ui/Block";
import Button from "../../ui/Button";
import KlickSuccess from "../../ui/KlickSuccess";
import Sheet from "../../ui/Sheet";
import ShareSheet from "../../ui/ShareSheet";
import { Api, type ContactField, type KlickItem } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { contactHref, FIELD_LABEL, firstName, initials, roleLine } from "../../lib/people";

type View = "requests" | "klicked" | "sent";

function Person({ item, children }: { item: KlickItem; children?: React.ReactNode }) {
  const name = item.other?.displayName ?? "A Klick member";
  const note = item.connection.context || item.connection.requestNote?.text;
  return (
    <article className="pd-card">
      <div className="pd-person">
        <span className={`pd-avatar ${item.connection.status === "accepted" ? "pd-avatar--brand" : ""}`}>{initials(name)}</span>
        <div className="k-grow">
          <h4>{name}</h4>
          {item.other && roleLine(item.other) && <p>{roleLine(item.other)}</p>}
        </div>
        {item.connection.status === "accepted" && <span className="pd-badge pd-badge--strong">Klicked</span>}
      </div>
      {item.event && (
        <p className="k-meta k-muted" style={{ marginTop: "var(--space-3)", fontSize: 13 }}>
          <CalendarDays className="pd-i" aria-hidden="true" />
          <Link to={`/events/${item.event.id}`} className="k-inline-link">
            {item.event.title}
          </Link>
        </p>
      )}
      {note && <p className="k-note-quote">"{note}"</p>}
      {children}
    </article>
  );
}

// Klicks: requests waiting for you, people you're connected with, and requests you've sent.
export default function Klicks() {
  const { data, error, reload } = useLoad(() => Api.connections());
  const [view, setView] = useState<View>("requests");
  const [accepting, setAccepting] = useState<KlickItem | null>(null);
  const [klicked, setKlicked] = useState<{ id: string; name: string; detail: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const all = data ?? [];
  const groups: Record<View, KlickItem[]> = {
    requests: all.filter((i) => i.connection.status === "pending" && i.incoming),
    klicked: all.filter((i) => i.connection.status === "accepted"),
    sent: all.filter((i) => i.connection.status === "pending" && !i.incoming),
  };
  const list = groups[view];
  const label: Record<View, string> = { requests: "Requests", klicked: "Klicked", sent: "Sent" };

  async function decline(item: KlickItem) {
    setBusy(item.connection.id);
    try {
      await Api.actOnConnection(item.connection.id, "decline");
      await reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Header title="Klicks" />
      <div className="pd-page k-stack">
        <div className="k-seg" role="tablist" aria-label="Which Klicks">
          {(Object.keys(label) as View[]).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}>
              {label[v]}
              {v === "requests" && groups.requests.length > 0 ? ` (${groups.requests.length})` : ""}
            </button>
          ))}
        </div>

        {error && (
          <Alert tone="destructive" title="Klick couldn't load your Klicks" action={<Button variant="outline" size="sm" onClick={reload}>Retry</Button>}>
            Check your connection and try again.
          </Alert>
        )}
        {!data && !error && <div className="k-spinner">Loading…</div>}

        {list.length > 0 && (
          <div className="pd-cards k-match-grid">
            {list.map((item) => (
              <Person key={item.connection.id} item={item}>
                {view === "requests" && (
                  <div className="pd-actions">
                    <Button variant="brand" onClick={() => setAccepting(item)}>
                      Accept
                    </Button>
                    <Button variant="ghost" loading={busy === item.connection.id} onClick={() => decline(item)}>
                      Decline
                    </Button>
                  </div>
                )}
                {view === "klicked" && (
                  <>
                    <dl className="k-contact">
                      {Object.entries(item.sharedContact).map(([f, v]) => (
                        <div key={f}>
                          <dt>{FIELD_LABEL[f as ContactField]}</dt>
                          <dd>
                            <a href={contactHref(f as ContactField, v!)} target="_blank" rel="noreferrer">
                              {v}
                            </a>
                          </dd>
                        </div>
                      ))}
                      {Object.keys(item.sharedContact).length === 0 && <p className="k-muted">Only your names were shared.</p>}
                    </dl>
                    <div className="pd-actions">
                      <Link to={`/klicks/${item.connection.id}`} className="pd-btn pd-btn--outline pd-btn--sm">
                        Memories and follow-ups
                      </Link>
                    </div>
                  </>
                )}
                {view === "sent" && <p className="k-muted" style={{ marginTop: "var(--space-3)", fontSize: 13 }}>Waiting for them to accept.</p>}
              </Person>
            ))}
          </div>
        )}

        {data && list.length === 0 && (
          <div className="k-empty">
            <Block studs={4} unit={14} />
            <h2>{view === "requests" ? "No requests right now" : view === "klicked" ? "No Klicks yet" : "Nothing sent"}</h2>
            <p>
              {view === "requests"
                ? "When someone at your events asks to Klick, you'll decide here what to share."
                : "Open an event and tap See who to meet, or show your QR to someone you've just met."}
            </p>
          </div>
        )}
      </div>

      {accepting && (
        <ShareSheet
          title={`Share with ${firstName(accepting.other?.displayName ?? "them")}`}
          description="They see these once you accept. You can change it later."
          cta={(n) => (n ? `Accept and share ${n} field${n === 1 ? "" : "s"}` : "Accept")}
          onClose={() => setAccepting(null)}
          onSubmit={async (fields) => {
            await Api.actOnConnection(accepting.connection.id, "accept", fields);
            const shared = ["name", ...fields.map((f) => FIELD_LABEL[f].toLowerCase())].join(", ");
            setKlicked({
              id: accepting.connection.id,
              name: firstName(accepting.other?.displayName ?? "them"),
              detail: `${accepting.event ? `${accepting.event.title}. ` : ""}You shared: ${shared}.`,
            });
            setAccepting(null);
            setView("klicked");
            void reload();
          }}
        />
      )}
      {klicked && (
        <Sheet title="Klicked" onClose={() => setKlicked(null)}>
          <div style={{ marginTop: "var(--space-3)" }}>
            <KlickSuccess name={klicked.name} detail={klicked.detail}>
              <Link to={`/klicks/${klicked.id}`} className="pd-btn pd-btn--primary">
                Add a memory
              </Link>
              <Button variant="ghost" onClick={() => setKlicked(null)}>
                Later
              </Button>
            </KlickSuccess>
          </div>
        </Sheet>
      )}
    </>
  );
}
