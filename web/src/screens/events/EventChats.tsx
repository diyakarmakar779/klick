import { Link } from "react-router-dom";
import { Lock, Plus, Sparkles } from "lucide-react";
import { Api } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { ChatRow } from "../chat/Chats";

// The event page's own Klick AI chats. Private to the member.
export default function EventChats({ eventId }: { eventId: string }) {
  const { data } = useLoad(() => Api.eventAiChats(eventId), [eventId]);
  return (
    <section className="k-esection">
      <div className="k-evchats__head">
        <div className="k-grow">
          <h2 className="k-evchats__title">Klick AI chats</h2>
          <p className="k-evchats__private">
            <Lock className="pd-i" aria-hidden="true" />
            Only you see these
          </p>
        </div>
        <Link to={`/events/${eventId}/ask`} className="pd-btn pd-btn--secondary pd-btn--sm">
          <Plus className="pd-i" aria-hidden="true" />
          New chat
        </Link>
      </div>
      {data && data.length > 0 ? (
        <ul className="k-chatlist k-chatlist--card">
          {data.slice(0, 5).map((c) => (
            <li key={c.id}>
              <ChatRow row={{ kind: "ai", id: c.id, title: c.title, subtitle: "", preview: c.preview, at: c.updatedAt, unread: 0 }} />
            </li>
          ))}
        </ul>
      ) : (
        data && (
          <Link to={`/events/${eventId}/ask`} className="k-starter">
            <Sparkles className="pd-i" aria-hidden="true" />
            <span className="k-grow">Ask who's going, who to meet, or how to prep</span>
          </Link>
        )
      )}
    </section>
  );
}
