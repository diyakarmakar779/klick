import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronDown, ChevronUp, Clock, Lock, Mic, Image as PhotoIcon, Plus } from "lucide-react";
import { Api, type DirectMessage, type DirectThread } from "../../lib/api";
import { clockTime, dayLabel, sameDay, shortDay } from "../../lib/chatTime";
import { useMe } from "../../lib/me";
import { firstName, initials, roleLine } from "../../lib/people";
import Alert from "../../ui/Alert";
import { Composer, DayPill, ThreadHeader, ThreadMenu } from "./parts";

const POLL_MS = 8000;

// Direct chat with someone you Klicked with. Your own memory of them is pinned at the top, and only you see it.
export default function DirectChat() {
  const { connectionId = "" } = useParams();
  const navigate = useNavigate();
  const { me } = useMe();
  const [thread, setThread] = useState<DirectThread | null>(null);
  const [loadError, setLoadError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [memoryOpen, setMemoryOpen] = useState(true);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    const load = () =>
      Api.directThread(connectionId)
        .then((t) => {
          if (!live) return;
          setThread(t);
          setLoadError("");
        })
        .catch(() => live && setLoadError("Klick couldn't load this chat. Check your connection."));
    load();
    // New messages arrive by checking every few seconds while the chat is open.
    const timer = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [connectionId]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [thread?.messages.length]);

  // Once you've started talking, the memory starts folded so the conversation has the room.
  useEffect(() => {
    if (thread && thread.messages.length > 3) setMemoryOpen(false);
  }, [thread?.connectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setFailed(null);
    setText("");
    try {
      const msg = await Api.sendDirect(connectionId, body);
      setThread((t) => (t ? { ...t, messages: [...t.messages, msg] } : t));
    } catch {
      setFailed(body);
    } finally {
      setSending(false);
    }
  }

  const name = thread?.other?.displayName ?? "";
  const first = firstName(name);
  const role = thread?.other ? roleLine(thread.other) : "";

  return (
    <div className="k-thread">
      <ThreadHeader
        title={name || undefined}
        sub={role || undefined}
        avatar={name ? <span className="pd-avatar pd-avatar--sm">{initials(name)}</span> : undefined}
        menu={<ThreadMenu items={[{ label: "View profile", onClick: () => navigate(`/klicks/${connectionId}`) }]} />}
      />
      <div className="k-thread__body">
        <div className="k-thread__inner">
          {loadError && !thread && <Alert tone="warning" title={loadError} />}
          {thread?.memory && (
            <div className="k-pinned">
              <button type="button" className="k-pinned__toggle" aria-expanded={memoryOpen} onClick={() => setMemoryOpen((o) => !o)}>
                Memory
                {memoryOpen ? <ChevronUp className="pd-i" aria-hidden="true" /> : <ChevronDown className="pd-i" aria-hidden="true" />}
              </button>
              {memoryOpen && <PinnedMemory thread={thread} connectionId={connectionId} />}
            </div>
          )}
          {thread && (
            <p className="k-metpill">
              {thread.met.eventTitle ? `You Klicked at ${thread.met.eventTitle}, ${shortDay(thread.met.at)}` : `You Klicked on ${shortDay(thread.met.at)}`}
            </p>
          )}
          {thread?.messages.map((m, i, all) => (
            <Message key={m.id} m={m} prev={all[i - 1]} next={all[i + 1]} mine={m.from === me?.id} />
          ))}
          {thread && thread.messages.length === 0 && <p className="k-caption k-center">Say hello to {first}. Only the two of you see this chat.</p>}
          {failed && (
            <>
              <div className="k-bubble k-bubble--me k-bubble--failed">{failed}</div>
              <p className="k-failed">
                Not sent.{" "}
                <button
                  type="button"
                  onClick={() => {
                    setText(failed);
                    setFailed(null);
                  }}
                >
                  Try again
                </button>
              </p>
            </>
          )}
          <div ref={end} />
        </div>
      </div>
      {thread && !thread.canSend ? (
        <p className="k-thread__ended">This Klick has ended, so new messages can't be sent.</p>
      ) : (
        <Composer
          placeholder={first ? `Message ${first}` : "Message"}
          value={text}
          onChange={setText}
          onSend={send}
          busy={sending}
          lead={
            <Link to={`/klicks/${connectionId}`} className="k-composer__lead" aria-label={`Add a memory about ${first || "them"}`}>
              <Plus className="pd-i" aria-hidden="true" />
            </Link>
          }
        />
      )}
    </div>
  );
}

function Message({ m, prev, next, mine }: { m: DirectMessage; prev?: DirectMessage; next?: DirectMessage; mine: boolean }) {
  const newDay = !prev || !sameDay(prev.createdAt, m.createdAt);
  const lastOfDay = !next || !sameDay(next.createdAt, m.createdAt);
  return (
    <>
      {newDay && <DayPill>{dayLabel(m.createdAt)}</DayPill>}
      <div className={`k-bubble ${mine ? "k-bubble--me" : "k-bubble--them"}`}>{m.text}</div>
      {lastOfDay && <time className={`k-msgtime${mine ? " k-msgtime--me" : ""}`}>{clockTime(m.createdAt)}</time>}
    </>
  );
}

// MemoryCard, pinned: the member's own latest note about this person, a follow-up they owe, and who can see it.
function PinnedMemory({ thread, connectionId }: { thread: DirectThread; connectionId: string }) {
  const m = thread.memory!;
  const text = m.reviewState === "reviewed" ? m.text : m.ai?.summary ?? m.text;
  const due = thread.followUp ? new Date(thread.followUp.dueAt).toLocaleDateString("en-GB", { weekday: "long" }) : null;
  return (
    <div className="k-memcard">
      {text && <p>{text}</p>}
      {m.kind !== "text" && (
        <span className="pd-pill k-self-start">
          {m.kind === "voice" ? <Mic className="pd-i" aria-hidden="true" /> : <PhotoIcon className="pd-i" aria-hidden="true" />}
          {m.kind === "voice" ? "Voice note" : "Photo"}
        </span>
      )}
      {thread.followUp && (
        <p className="k-memcard__due">
          <Clock className="pd-i" aria-hidden="true" />
          {thread.followUp.reason} · Due {due}
        </p>
      )}
      <div className="k-memcard__foot">
        <span>
          <Lock className="pd-i" aria-hidden="true" />
          Only you{thread.met.eventTitle ? ` · ${thread.met.eventTitle}, ${shortDay(m.createdAt)}` : ""}
        </span>
        <Link to={`/klicks/${connectionId}`} className="pd-btn pd-btn--ghost pd-btn--sm">
          Edit
        </Link>
      </div>
    </div>
  );
}
