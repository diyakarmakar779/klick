import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  MoreVertical,
  Sparkles,
  Send,
  Square,
  Users,
  X,
} from "lucide-react";
import type { AiMessage, ChatPerson, KlickEvent } from "../../lib/api";
import { Api } from "../../lib/api";
import { dateTab, PARTICIPATION } from "../../lib/eventFormat";
import { firstName, initials, roleLine } from "../../lib/people";
import Button from "../../ui/Button";
import Sheet from "../../ui/Sheet";
import ShareSheet from "../../ui/ShareSheet";

// Thread header: back, an optional avatar, title and subtitle, and a menu.
export function ThreadHeader({ title, sub, avatar, menu }: { title?: string; sub?: string; avatar?: ReactNode; menu?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="k-thread__head">
      <button type="button" className="pd-btn pd-btn--ghost pd-btn--icon" aria-label="Back" onClick={() => (history.length > 1 ? navigate(-1) : navigate("/chats"))}>
        <ArrowLeft className="pd-i" aria-hidden="true" />
      </button>
      {avatar}
      <div className="k-grow k-thread__title">
        {title && <h1>{title}</h1>}
        {sub && <p>{sub}</p>}
      </div>
      {menu}
    </header>
  );
}

// A ⋮ button with a small menu of actions.
export function ThreadMenu({ items }: { items: Array<{ label: string; onClick: () => void; danger?: boolean }> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="k-menu">
      <button type="button" className="pd-btn pd-btn--ghost pd-btn--icon" aria-label="More" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <MoreVertical className="pd-i" aria-hidden="true" />
      </button>
      {open && (
        <div className="k-menu__list" role="menu">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              className={it.danger ? "k-menu__danger" : ""}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DayPill({ children }: { children: ReactNode }) {
  return <div className="k-daypill">{children}</div>;
}

// Message box pinned to the bottom. While waiting, the send button turns into stop.
export function Composer({
  placeholder,
  value,
  onChange,
  onSend,
  waiting,
  onStop,
  busy,
  lead,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  waiting?: boolean;
  onStop?: () => void;
  busy?: boolean;
  lead?: ReactNode;
}) {
  return (
    <form
      className="k-thread__compose"
      onSubmit={(e) => {
        e.preventDefault();
        if (!waiting && !busy && value.trim()) onSend();
      }}
    >
      <div className="k-composer">
        {lead}
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} maxLength={500} enterKeyHint="send" />
        {waiting ? (
          <button type="button" className="k-composer__send" aria-label="Stop waiting" onClick={onStop}>
            <Square className="pd-i" aria-hidden="true" fill="currentColor" />
          </button>
        ) : (
          <button type="submit" className="k-composer__send" aria-label="Send" disabled={busy || !value.trim()}>
            <Send className="pd-i" aria-hidden="true" />
          </button>
        )}
      </div>
    </form>
  );
}

export function AiAvatar({ size = 44 }: { size?: number }) {
  return (
    <span className="k-aiicon" style={{ width: size, height: size }} aria-hidden="true">
      <ImageIcon className="pd-i" />
    </span>
  );
}

// "Sat, 6:30 PM · Indiranagar"
function shortWhen(e: KlickEvent) {
  const d = new Date(e.startsAt);
  const opts: Intl.DateTimeFormatOptions = { timeZone: e.timezone ?? undefined };
  const day = d.toLocaleDateString("en-GB", { ...opts, weekday: "short" });
  const time = d.toLocaleTimeString("en-US", { ...opts, hour: "numeric", minute: "2-digit" });
  const place = e.venue.online ? "Online" : e.venue.city ?? e.venue.name;
  return [`${day}, ${time}`, place].filter(Boolean).join(" · ");
}

// EventCard, compact row: date tab, title, when and where.
export function EventMini({ event, to, badge }: { event: KlickEvent; to: string; badge?: ReactNode }) {
  const tab = dateTab(event);
  return (
    <Link to={to} className="k-mini">
      <span className="pd-date k-mini__date">
        <div>{tab.month}</div>
        <div>{tab.day}</div>
      </span>
      <span className="k-grow k-mini__body">
        <b>{event.title}</b>
        <small>{shortWhen(event)}</small>
      </span>
      {badge}
      <ChevronRight className="pd-i k-mini__chev" aria-hidden="true" />
    </Link>
  );
}

// MatchCard, compact row: round avatar, name, role, and a Klicked badge for people you already know.
export function PersonMini({ person, onOpen }: { person: ChatPerson; onOpen: () => void }) {
  const p = person.profile;
  return (
    <button type="button" className="k-mini" onClick={onOpen}>
      <span className="pd-avatar pd-avatar--sm k-mini__avatar">{initials(p.displayName)}</span>
      <span className="k-grow k-mini__body">
        <b>{p.displayName}</b>
        {roleLine(p) && <small>{roleLine(p)}</small>}
      </span>
      {person.kind === "klick" && <span className="k-klicked">Klicked</span>}
      <ChevronRight className="pd-i k-mini__chev" aria-hidden="true" />
    </button>
  );
}

const SOURCE_ICON = (key: string) => {
  if (key === "klicks") return Users;
  if (key.startsWith("memory:")) return FileText;
  if (key.startsWith("saved:")) return Bookmark;
  if (key === "events") return CalendarDays;
  return Sparkles;
};

// One Klick AI answer: text, then the people or events it points to, where it came from, and what to ask next.
export function AiAnswer({
  message,
  eventId,
  last,
  onAsk,
  onPerson,
}: {
  message: AiMessage;
  eventId: string;
  last: boolean;
  onAsk: (q: string) => void;
  onPerson: (p: ChatPerson) => void;
}) {
  const navigate = useNavigate();
  const [allEvents, setAllEvents] = useState(false);
  const events = allEvents ? message.events : message.events.slice(0, 3);
  return (
    <div className="k-answer">
      {message.text.split(/\n{2,}/).map((para, i) => (
        <p key={i}>{para}</p>
      ))}
      {message.people.length > 0 && (
        <div className="k-answer__list">
          {message.people.map((p) => (
            <PersonMini
              key={p.profile.id}
              person={p}
              onOpen={() => (p.kind === "klick" && p.connectionId ? navigate(`/klicks/${p.connectionId}`) : onPerson(p))}
            />
          ))}
        </div>
      )}
      {events.length > 0 && (
        <div className="k-answer__list">
          {events.map((e) => (
            <EventMini key={e.event.id} event={e.event} to={e.event.id === eventId ? `/events/${eventId}` : `/discover/${e.event.id}`} />
          ))}
          {!allEvents && message.events.length > 3 && (
            <button type="button" className="pd-btn pd-btn--link k-self-start" onClick={() => setAllEvents(true)}>
              Show all {message.events.length} events
              <ChevronRight className="pd-i" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
      {message.sources.length > 0 && (
        <div className="k-sources" aria-label="Based on">
          {message.sources.map((s) => {
            const Icon = SOURCE_ICON(s.key);
            return (
              <span key={s.key} className="k-source">
                <Icon className="pd-i" aria-hidden="true" />
                {s.label}
              </span>
            );
          })}
        </div>
      )}
      {last && message.suggestions.length > 0 && (
        <div className="k-suggest">
          {message.suggestions.map((s) => (
            <button key={s} type="button" className="k-suggest__chip" onClick={() => onAsk(s)}>
              <Sparkles className="pd-i" aria-hidden="true" />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Someone Klick AI suggested, opened from an answer. Same rules as the event page: name, role and company only.
export function SuggestedSheet({ person, eventId, onClose }: { person: ChatPerson; eventId: string; onClose: () => void }) {
  const p = person.profile;
  const [saved, setSaved] = useState(!!person.saved);
  const [asking, setAsking] = useState(false);
  const [sent, setSent] = useState(false);
  const state = person.state ? PARTICIPATION[person.state] : null;

  async function toggleSave() {
    const on = !saved;
    setSaved(on);
    try {
      await (on ? Api.savePerson(eventId, p.id, person.reason) : Api.unsavePerson(eventId, p.id));
    } catch {
      setSaved(!on);
    }
  }

  if (asking)
    return (
      <ShareSheet
        title={`Request a Klick with ${firstName(p.displayName)}`}
        description="Choose what they see if they accept. Until then they only see your name, role and note."
        cta={(n) => (n ? `Send request and share ${n} field${n === 1 ? "" : "s"}` : "Send request")}
        withNote
        onClose={() => setAsking(false)}
        onSubmit={async (fields, note) => {
          await Api.requestKlick({ to: p.id, eventId, context: note, shareFields: fields });
          setSent(true);
          setAsking(false);
        }}
      />
    );

  return (
    <Sheet title="Suggested for this event" onClose={onClose}>
      <button type="button" className="pd-btn pd-btn--ghost pd-btn--icon k-sheet__x" aria-label="Close" onClick={onClose}>
        <X className="pd-i" aria-hidden="true" />
      </button>
      <div className="k-suggested">
        <div className="k-suggested__who">
          <span className="pd-avatar pd-avatar--lg">{initials(p.displayName)}</span>
          <div>
            <h4>{p.displayName}</h4>
            {roleLine(p) && <p>{roleLine(p)}</p>}
          </div>
        </div>
        {person.reason && (
          <div className="pd-why">
            <b>
              <Sparkles className="pd-i" aria-hidden="true" />
              Why this match
            </b>
            {person.reason}
          </div>
        )}
        {(state || person.tags?.length) && (
          <div className="pd-chips">
            {state && <span className="pd-badge pd-badge--brand">{state}</span>}
            {person.tags?.map((t) => (
              <span key={t} className="pd-badge pd-badge--outline">
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="k-suggested__actions">
          {sent ? (
            <span className="k-status k-status--went k-grow">Request sent</span>
          ) : (
            <Button variant="brand" className="k-grow" onClick={() => setAsking(true)}>
              Request a Klick
            </Button>
          )}
          <Button variant="outline" size="icon" aria-label={saved ? "Saved" : "Save for later"} aria-pressed={saved} onClick={toggleSave}>
            {saved ? <BookmarkCheck className="pd-i" aria-hidden="true" /> : <Bookmark className="pd-i" aria-hidden="true" />}
          </Button>
          <Button variant="ghost" size="icon" aria-label="Not now" onClick={onClose}>
            <X className="pd-i" aria-hidden="true" />
          </Button>
        </div>
        <p className="k-caption">You see their name, photo, role and company. The rest is shared after you both accept.</p>
      </div>
    </Sheet>
  );
}
