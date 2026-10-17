import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { CalendarDays, ChevronRight, Clock, Image as ImageIcon, Sparkles, Users } from "lucide-react";
import { Api, ApiError, type AiChatView, type AiMessage, type ChatPerson, type KlickEvent } from "../../lib/api";
import { dayLabel, sameDay } from "../../lib/chatTime";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import { AiAnswer, Composer, DayPill, SuggestedSheet, ThreadHeader, ThreadMenu } from "./parts";

const STARTERS = [
  { text: "Who from my Klicks is going?", icon: Users },
  { text: "Who should I meet there?", icon: Sparkles },
  { text: "Other events I should consider", icon: CalendarDays },
  { text: "Help me prep in 10 minutes", icon: Clock },
];

// What the loading line says while Klick AI works, from the question's wording.
function working(q: string) {
  const s = q.toLowerCase();
  if (/event|consider/.test(s)) return "Checking your Klicks' events";
  if (/klick|catch up|know/.test(s)) return "Checking your Klicks";
  if (/meet|who/.test(s)) return "Looking at who chose to be found";
  return "Thinking it through";
}

// Klick AI about one event. /events/:eventId/ask starts a new chat; /chats/ai/:chatId continues one.
export default function AiChat() {
  const { eventId: newFor, chatId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState<AiChatView | null>((location.state as { view?: AiChatView } | null)?.view ?? null);
  const [event, setEvent] = useState<KlickEvent | null>(view?.event ?? null);
  const [loadError, setLoadError] = useState("");
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [person, setPerson] = useState<ChatPerson | null>(null);
  const ask = useRef(0); // the latest question; a stopped or superseded answer is ignored
  const end = useRef<HTMLDivElement>(null);

  const eventId = newFor ?? view?.chat.eventId ?? "";

  useEffect(() => {
    if (!chatId || view?.chat.id === chatId) return;
    Api.aiChat(chatId)
      .then((v) => {
        setView(v);
        setEvent(v.event ?? null);
      })
      .catch((e) => setLoadError(e instanceof ApiError && e.status === 404 ? "This chat isn't there any more." : "Klick couldn't load this chat."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  useEffect(() => {
    if (newFor && !event) Api.event(newFor).then((p) => setEvent(p.event), () => setLoadError("Klick couldn't load this event."));
  }, [newFor, event]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [view?.messages.length, pending]);

  async function send(q: string) {
    const question = q.trim();
    if (!question) return;
    const n = ++ask.current;
    setPending(question);
    setText("");
    setError("");
    try {
      const next = view ? await Api.askAiChat(view.chat.id, question) : await Api.startAiChat(eventId, question);
      if (n !== ask.current) return;
      const merged = { ...next, event };
      setView(merged);
      if (!view) navigate(`/chats/ai/${next.chat.id}`, { replace: true, state: { view: merged } });
    } catch (e) {
      if (n !== ask.current) return;
      setText(question);
      setError(
        e instanceof ApiError && e.retryable
          ? "Klick AI couldn't answer just now. Your question is still in the box, so you can send it again."
          : e instanceof Error
            ? e.message
            : "Something went wrong.",
      );
    } finally {
      if (n === ask.current) setPending(null);
    }
  }

  function stop() {
    ask.current++;
    if (pending) setText(pending);
    setPending(null);
  }

  async function remove() {
    if (!view || !confirm("Delete this chat? This can't be undone.")) return;
    await Api.deleteAiChat(view.chat.id).catch(() => null);
    navigate(-1);
  }

  const messages = view?.messages ?? [];
  const lastAi = [...messages].reverse().find((m) => m.role === "ai")?.id;
  const started = messages.length > 0 || !!pending;

  return (
    <div className="k-thread">
      <ThreadHeader
        title={view?.chat.title ?? (pending ? pending.replace(/[?.!]+$/, "") : undefined)}
        sub={started ? event?.title : undefined}
        menu={view ? <ThreadMenu items={[{ label: "Delete chat", onClick: remove, danger: true }]} /> : undefined}
      />
      <div className="k-thread__body">
        <div className="k-thread__inner">
          {loadError && <Alert tone="warning" title={loadError} />}
          {!started && !loadError && (
            <div className="k-aistart">
              <span className="k-aistart__img">
                {event?.coverImageUrl ? <img src={event.coverImageUrl} alt="" /> : <ImageIcon className="pd-i" aria-hidden="true" />}
              </span>
              <h2>{event?.title ?? " "}</h2>
              <p>Ask anything about this event</p>
              <div className="k-aistart__list">
                {STARTERS.map(({ text: t, icon: Icon }) => (
                  <button key={t} type="button" className="k-starter" onClick={() => send(t)} disabled={!event}>
                    <Icon className="pd-i" aria-hidden="true" />
                    <span className="k-grow">{t}</span>
                    <ChevronRight className="pd-i k-mini__chev" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <Turn key={m.id} m={m} prev={messages[i - 1]} eventId={eventId} last={m.id === lastAi && !pending} onAsk={send} onPerson={setPerson} />
          ))}
          {pending && (
            <>
              {!messages.length && <DayPill>Today</DayPill>}
              <div className="k-bubble k-bubble--me">{pending}</div>
              <p className="k-working" role="status">
                <span className="k-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                {working(pending)}
              </p>
            </>
          )}
          {error && (
            <Alert tone="warning" title="No answer this time" action={<Button variant="outline" size="sm" onClick={() => send(text)}>Retry</Button>}>
              {error}
            </Alert>
          )}
          <div ref={end} />
        </div>
      </div>
      <Composer
        placeholder={`Ask about ${event?.title ?? "this event"}`}
        value={text}
        onChange={setText}
        onSend={() => send(text)}
        waiting={!!pending}
        onStop={stop}
      />
      {person && <SuggestedSheet person={person} eventId={eventId} onClose={() => setPerson(null)} />}
    </div>
  );
}

function Turn({
  m,
  prev,
  eventId,
  last,
  onAsk,
  onPerson,
}: {
  m: AiMessage;
  prev?: AiMessage;
  eventId: string;
  last: boolean;
  onAsk: (q: string) => void;
  onPerson: (p: ChatPerson) => void;
}) {
  return (
    <>
      {(!prev || !sameDay(prev.createdAt, m.createdAt)) && <DayPill>{dayLabel(m.createdAt)}</DayPill>}
      {m.role === "me" ? (
        <div className="k-bubble k-bubble--me">{m.text}</div>
      ) : (
        <AiAnswer message={m} eventId={eventId} last={last} onAsk={onAsk} onPerson={onPerson} />
      )}
    </>
  );
}
