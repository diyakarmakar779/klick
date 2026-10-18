import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Image as ImageIcon, Send } from "lucide-react";
import Alert from "../../ui/Alert";
import WelcomeBlocks from "../../ui/WelcomeBlocks";
import { Api } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { useMe } from "../../lib/me";
import { initials } from "../../lib/people";
import { isPast } from "../../lib/eventFormat";

export default function NewChat() {
  const { me } = useMe();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const connections = useLoad(() => Api.connections("accepted"));
  const events = useLoad(() => Api.events());
  const designPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "chat-history";
  const person = (connections.data ?? []).find((item) => item.other);
  const upcoming = (events.data ?? []).filter((item) => !isPast(item.event)).slice(0, 2);

  const liveSuggestions = [
    ...upcoming.map(({ event }, index) => ({
      id: event.id,
      label: index === 0 ? `Who should I meet at ${event.title}?` : `Prep for ${event.title}`,
      to: `/events/${event.id}/ask`,
      kind: "event" as const,
    })),
    ...(person?.other ? [{ id: person.connection.id, label: `Chat with ${person.other.displayName}`, to: `/chats/c/${person.connection.id}`, kind: "person" as const, name: person.other.displayName }] : []),
  ].slice(0, 3);
  const suggestions = designPreview
    ? [
        { id: "meet", label: "Who should I meet tomorrow?", to: "/chats/new?preview=chat-history", kind: "event" as const },
        { id: "meera", label: "Reply to Meera", to: "/chats/new?preview=chat-history", kind: "person" as const, name: "Meera Iyer" },
        { id: "prep", label: "Prep for the roundtable", to: "/chats/new?preview=chat-history", kind: "event" as const },
      ]
    : liveSuggestions;

  async function send() {
    const text = query.trim();
    const event = upcoming[0]?.event;
    if (!text || !event || sending) return;
    setSending(true);
    setSendError("");
    try {
      const view = await Api.startAiChat(event.id, text);
      navigate(`/chats/ai/${view.chat.id}`, { state: { view } });
    } catch {
      setSendError("Klick couldn't start this chat. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="k-new-chat">
      <header className="k-new-chat__head">
        <Link to="/chats" className="pd-btn pd-btn--ghost pd-btn--icon" aria-label="Back to chats">
          <ArrowLeft className="pd-i" aria-hidden="true" />
        </Link>
      </header>

      <WelcomeBlocks name={me?.displayName ?? "there"} className="k-new-chat__hero" subtitle={null}>
        <form className="k-new-chat__composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask anything" aria-label="Message" />
          <button className="pd-btn pd-btn--primary pd-btn--icon" type="submit" disabled={!query.trim() || !upcoming[0] || sending} aria-label="Send">
            <Send className="pd-i" aria-hidden="true" />
          </button>
        </form>
        {!query && suggestions.length > 0 && (
          <div className="k-new-chat__suggestions" aria-label="Suggestions">
            {suggestions.map((suggestion) => (
              <Link key={`${suggestion.kind}-${suggestion.id}`} to={suggestion.to} className="k-new-chat__suggestion">
                {suggestion.kind === "person" ? (
                  <span className="pd-avatar pd-avatar--brand" aria-hidden="true">{initials(suggestion.name!)}</span>
                ) : (
                  <span className="k-new-chat__suggestion-icon" aria-hidden="true"><ImageIcon className="pd-i" /></span>
                )}
                {suggestion.label}
              </Link>
            ))}
          </div>
        )}
        {!designPreview && (connections.error || events.error) && (
          <div className="k-new-chat__error">
            <Alert tone="warning" title="Suggestions couldn't load">You can still return to Chats and try again.</Alert>
          </div>
        )}
        {sendError && <div className="k-new-chat__error"><Alert tone="warning" title={sendError} /></div>}
      </WelcomeBlocks>
    </div>
  );
}
