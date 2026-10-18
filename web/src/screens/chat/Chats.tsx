import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Users } from "lucide-react";
import Header from "../../layout/Header";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import { Api, type ChatRow as Row } from "../../lib/api";
import { rowTime } from "../../lib/chatTime";
import { initials } from "../../lib/people";
import { useLoad } from "../../lib/useLoad";
import { AiAvatar } from "./parts";

type Filter = "all" | "ai" | "person";
const FILTERS: Array<[Filter, string]> = [
  ["all", "All"],
  ["ai", "Events"],
  ["person", "People"],
];

// Chats tab: Klick AI chats about your events and messages with people you Klicked with, newest first.
export default function Chats() {
  const { data, error, reload } = useLoad(() => Api.chats(), []);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? [])
      .filter((r) => filter === "all" || r.kind === filter)
      .filter((r) => !q || [r.title, r.subtitle, r.preview].some((s) => s.toLowerCase().includes(q)));
  }, [data, filter, query]);

  return (
    <>
      <Header
        title="Chats"
        action={
          <span className="k-header__actions">
            <Link to="/chats/new" className="pd-btn pd-btn--primary pd-btn--sm">
              <Plus className="pd-i" aria-hidden="true" />
              New
            </Link>
            <Link to="/klicks" className="pd-btn pd-btn--ghost pd-btn--sm">
              <Users className="pd-i" aria-hidden="true" />
              Klicks
            </Link>
          </span>
        }
      />
      <div className="pd-page k-stack">
        <div className="pd-search">
          <Search className="pd-i" aria-hidden="true" />
          <input className="pd-input" type="search" placeholder="Search people, events and chats" aria-label="Search chats" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="k-seg k-seg--hug" role="tablist" aria-label="Which chats">
          {FILTERS.map(([f, label]) => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>
              {label}
            </button>
          ))}
        </div>

        {error && (
          <Alert tone="destructive" title="Klick couldn't load your chats" action={<Button variant="outline" size="sm" onClick={reload}>Retry</Button>}>
            Check your connection and try again.
          </Alert>
        )}

        {data && rows.length === 0 && (
          <div className="k-empty">
            {query ? (
              <p>No chats match "{query}".</p>
            ) : (
              <>
                <p>
                  {filter === "person"
                    ? "Message someone from their page once you've Klicked."
                    : filter === "ai"
                      ? "Open one of your events and ask Klick AI who to meet, or how to prep."
                      : "No chats yet. Ask Klick AI from one of your events, or message someone you've Klicked with."}
                </p>
                <Link to={filter === "person" ? "/klicks" : "/events"} className="pd-btn pd-btn--outline pd-btn--sm">
                  {filter === "person" ? "Your Klicks" : "Your events"}
                </Link>
              </>
            )}
          </div>
        )}

        {rows.length > 0 && (
          <ul className="k-chatlist">
            {rows.map((r) => (
              <li key={`${r.kind}:${r.id}`}>
                <ChatRow row={r} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

// ChatRow: Klick AI chats show the event mark, people their round avatar.
export function ChatRow({ row }: { row: Row }) {
  return (
    <Link to={row.kind === "ai" ? `/chats/ai/${row.id}` : `/chats/c/${row.id}`} className="k-chatrow">
      {row.kind === "ai" ? <AiAvatar /> : <span className="pd-avatar">{initials(row.title)}</span>}
      <span className="k-grow k-chatrow__body">
        <span className="k-chatrow__top">
          <b>{row.title}</b>
          <time>{rowTime(row.at)}</time>
        </span>
        <span className="k-chatrow__bottom">
          <span className="k-chatrow__preview">{row.preview}</span>
          {row.unread > 0 && (
            <span className="k-unread" aria-label={`${row.unread} unread`}>
              {row.unread}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
