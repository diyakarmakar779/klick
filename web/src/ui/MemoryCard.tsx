import { CalendarDays, Check, Lock, Mic, Trash2, Users, Volume2 } from "lucide-react";
import type { Memory } from "../lib/api";
import { initials, speak } from "../lib/people";
import Button from "./Button";

// One private memory about a person. "Only you" unless the member explicitly shared it.
export default function MemoryCard({
  memory,
  name,
  eventTitle,
  readAloud,
  onShare,
  onDelete,
}: {
  memory: Memory;
  name: string;
  eventTitle?: string;
  readAloud: boolean;
  onShare?: () => void;
  onDelete: () => void;
}) {
  const shared = memory.sharedWith.length > 0;
  const date = new Date(memory.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const text = memory.text ?? memory.aiDraft ?? "";
  return (
    <article className="pd-card">
      <div className="pd-person">
        <span className="pd-avatar pd-avatar--sm">{initials(name)}</span>
        <div>
          <h4 style={{ fontSize: 14 }}>{name}</h4>
          <p>Memory</p>
        </div>
        <span className="pd-badge pd-badge--privacy" style={{ marginLeft: "auto" }}>
          {shared ? <Users className="pd-i" aria-hidden="true" /> : <Lock className="pd-i" aria-hidden="true" />}
          {shared ? "Shared with them" : "Only you"}
        </span>
      </div>
      <p className="k-memory-text">{text}</p>
      <div className="pd-chips" style={{ marginTop: "var(--space-3)" }}>
        <span className="pd-pill">
          <CalendarDays className="pd-i" aria-hidden="true" />
          {eventTitle ? `${eventTitle}, ${date}` : date}
        </span>
        {memory.reviewState === "reviewed" && (
          <span className="pd-pill">
            <Check className="pd-i" aria-hidden="true" />
            Confirmed by you
          </span>
        )}
        {memory.kind === "voice" && (
          <span className="pd-pill">
            <Mic className="pd-i" aria-hidden="true" />
            Voice note
          </span>
        )}
        {memory.ai?.topics.slice(0, 3).map((t) => (
          <span key={t} className="pd-badge pd-badge--outline">
            {t}
          </span>
        ))}
      </div>
      <div className="pd-actions">
        {readAloud && (
          <Button variant="ghost" size="sm" onClick={() => speak(text)}>
            <Volume2 className="pd-i" aria-hidden="true" />
            Read aloud
          </Button>
        )}
        {onShare && !shared && (
          <Button variant="ghost" size="sm" onClick={onShare}>
            <Users className="pd-i" aria-hidden="true" />
            Share with {name.split(" ")[0]}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Delete memory" style={{ marginLeft: "auto" }}>
          <Trash2 className="pd-i" aria-hidden="true" />
        </Button>
      </div>
    </article>
  );
}
