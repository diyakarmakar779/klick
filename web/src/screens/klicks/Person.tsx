import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Mic, Sparkles, Square } from "lucide-react";
import Header from "../../layout/Header";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import FollowUpRow from "../../ui/FollowUpRow";
import MemoryCard from "../../ui/MemoryCard";
import { Api, type ContactField, type Memory } from "../../lib/api";
import { useMe } from "../../lib/me";
import { useLoad } from "../../lib/useLoad";
import { clock, useRecorder } from "../../lib/useRecorder";
import { FIELD_LABEL, firstName, initials, roleLine } from "../../lib/people";

// One Klick: what they shared, your private memories about them, and follow-ups you choose to keep.
export default function Person() {
  const { connectionId = "" } = useParams();
  const { me } = useMe();
  const conn = useLoad(() => Api.connection(connectionId), [connectionId]);
  const mems = useLoad(() => Api.memories(connectionId), [connectionId]);
  const fus = useLoad(() => Api.followUps(), []);
  const event = useLoad(async () => (conn.data?.connection.eventId ? Api.event(conn.data.connection.eventId).catch(() => null) : null), [conn.data?.connection.eventId]);
  const rec = useRecorder();

  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"save" | "review" | null>(null);
  const [draft, setDraft] = useState<{ memory: Memory; text: string; remind: boolean } | null>(null);
  const [error, setError] = useState("");

  const name = conn.data?.other?.displayName ?? "This person";
  const first = firstName(name);
  const accepted = conn.data?.connection.status === "accepted";
  const eventId = conn.data?.connection.eventId ?? null;
  const readAloud = !!me?.accessibility.readAloud;

  const back = (
    <Link to="/klicks" className="pd-btn pd-btn--ghost pd-btn--icon k-back" aria-label="Back to Klicks">
      <ArrowLeft className="pd-i" aria-hidden="true" />
    </Link>
  );

  // Save what was typed or said, then ask Gemini for a summary to review. If that fails, keep the note as written.
  async function save() {
    setBusy("save");
    setError("");
    try {
      let memory: Memory;
      if (rec.clip) {
        const up = await Api.upload("voice", rec.clip.type);
        const put = await fetch(up.url, { method: "PUT", headers: { "content-type": rec.clip.type }, body: rec.clip.blob });
        if (!put.ok) throw new Error("The voice note didn't upload. Check your connection and try again.");
        memory = await Api.createMemory({ kind: "voice", text: note.trim() || null, storagePath: up.storagePath, connectionId, eventId });
      } else {
        memory = await Api.createMemory({ kind: "text", text: note.trim(), storagePath: null, connectionId, eventId });
      }
      try {
        const analysed = await Api.analyzeMemory(memory.id);
        setDraft({ memory: analysed, text: analysed.ai?.summary ?? analysed.text ?? "", remind: !!analysed.ai?.suggestedFollowUp });
      } catch {
        if (memory.kind === "voice" && !memory.text) {
          setDraft({ memory, text: "", remind: false });
          setError("Gemini couldn't transcribe this one. Add a line about it so you remember.");
        } else {
          mems.setData((m) => [memory, ...(m ?? [])]);
        }
      }
      setNote("");
      rec.clear();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function confirm() {
    if (!draft) return;
    setBusy("review");
    setError("");
    try {
      const saved = await Api.reviewMemory(draft.memory.id, draft.text.trim());
      const suggestion = draft.memory.ai?.suggestedFollowUp;
      if (draft.remind && suggestion && accepted) {
        const fu = await Api.createFollowUp({ connectionId, reason: suggestion.reason, dueAt: suggestion.dueAt, sourceMemoryId: saved.id });
        fus.setData((f) => [fu, ...(f ?? [])]);
      }
      mems.setData((m) => [{ ...saved, ai: draft.memory.ai }, ...(m ?? []).filter((x) => x.id !== saved.id)]);
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (conn.error)
    return (
      <>
        <Header title="Klick" back={back} />
        <div className="pd-page k-stack">
          <Alert title="This Klick isn't available">It may have been removed. Your other Klicks are in the Klicks tab.</Alert>
        </div>
      </>
    );
  if (!conn.data)
    return (
      <>
        <Header title="Klick" back={back} />
        <div className="k-spinner">Loading…</div>
      </>
    );

  const memories = (mems.data ?? []).filter((m) => m.reviewState === "reviewed" || m.id !== draft?.memory.id);
  const followUps = (fus.data ?? []).filter((f) => f.connectionId === connectionId && f.status !== "dismissed");
  const shared = Object.entries(conn.data.sharedContact);

  return (
    <>
      <Header title={first} back={back} />
      <div className="pd-page pd-page--narrow k-stack">
        <div className="pd-person">
          <span className="pd-avatar pd-avatar--lg pd-avatar--brand">{initials(name)}</span>
          <div>
            <h4 style={{ fontSize: 18 }}>{name}</h4>
            {conn.data.other && <p>{roleLine(conn.data.other)}</p>}
          </div>
        </div>

        {shared.length > 0 && (
          <dl className="k-contact pd-card" style={{ marginTop: 0 }}>
            {shared.map(([f, v]) => (
              <div key={f}>
                <dt>{FIELD_LABEL[f as ContactField]}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}

        {error && <Alert tone="warning" title={error} />}

        {draft ? (
          <section className="pd-card k-review">
            <h3 className="k-section-title">
              <Sparkles className="pd-i" aria-hidden="true" /> Check this before it's saved
            </h3>
            <p className="k-muted" style={{ fontSize: 13 }}>Gemini summarised your note. Edit anything that's wrong; only you will see it.</p>
            <textarea className="pd-input k-textarea" rows={4} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} aria-label="Memory" />
            {draft.memory.ai?.promises.length ? (
              <ul className="k-promises">
                {draft.memory.ai.promises.map((p, i) => (
                  <li key={i}>
                    <b>{p.owner === "me" ? "You said you'd" : `${first} said they'd`}</b> {p.text.replace(/^(to )/i, "")}
                  </li>
                ))}
              </ul>
            ) : null}
            {draft.memory.ai?.suggestedFollowUp && accepted && (
              <label className="k-check">
                <input type="checkbox" checked={draft.remind} onChange={(e) => setDraft({ ...draft, remind: e.target.checked })} />
                Remind me: {draft.memory.ai.suggestedFollowUp.reason} ({new Date(draft.memory.ai.suggestedFollowUp.dueAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})
              </label>
            )}
            <div className="pd-actions">
              <Button variant="primary" loading={busy === "review"} disabled={!draft.text.trim()} onClick={confirm}>
                Save memory
              </Button>
            </div>
          </section>
        ) : (
          <section className="k-q" style={{ marginTop: 0 }}>
            <label htmlFor="memory">
              <b>Add a memory</b> <span className="k-muted">(only you see it)</span>
            </label>
            {rec.recording ? (
              <div className="k-recording" aria-live="polite">
                <span className="k-rec-dot" aria-hidden="true" /> Recording {clock(rec.seconds)}
              </div>
            ) : rec.clip ? (
              <div className="k-recording k-recording--done">
                <Mic className="pd-i" aria-hidden="true" /> Voice note, {clock(rec.clip.seconds)}
                <button type="button" className="pd-btn pd-btn--ghost pd-btn--sm" onClick={rec.clear}>
                  Remove
                </button>
              </div>
            ) : (
              <textarea
                id="memory"
                className="pd-input k-textarea"
                rows={3}
                maxLength={5000}
                placeholder={`What did you talk about? Anything you promised ${first}?`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
            {rec.error && <small className="k-error">{rec.error}</small>}
            <div className="k-row" style={{ justifyContent: "space-between" }}>
              {rec.supported && !note.trim() ? (
                rec.recording ? (
                  <Button variant="outline" size="sm" onClick={rec.stop}>
                    <Square className="pd-i" aria-hidden="true" />
                    Stop
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={rec.start} disabled={!!rec.clip}>
                    <Mic className="pd-i" aria-hidden="true" />
                    Record a voice note
                  </Button>
                )
              ) : (
                <span />
              )}
              <Button variant="primary" size="sm" loading={busy === "save"} disabled={rec.recording || (!note.trim() && !rec.clip)} onClick={save}>
                Save
              </Button>
            </div>
          </section>
        )}

        {followUps.length > 0 && (
          <section>
            <h3 className="k-section-title">Follow-ups</h3>
            <div className="k-list">
              {followUps.map((f) => (
                <FollowUpRow
                  key={f.id}
                  followUp={f}
                  name={first}
                  simpleLanguage={!!me?.accessibility.simpleLanguage}
                  onChange={(n) => fus.setData((all) => (all ?? []).map((x) => (x.id === n.id ? n : x)))}
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <h3 className="k-section-title">Memories</h3>
          {memories.length === 0 ? (
            <p className="k-muted">Nothing yet. A line or a quick voice note now makes it easy to pick up later.</p>
          ) : (
            <div className="k-list">
              {memories.map((m) => (
                <MemoryCard
                  key={m.id}
                  memory={m}
                  name={name}
                  eventTitle={m.eventId && m.eventId === event.data?.event.id ? event.data.event.title : undefined}
                  readAloud={readAloud}
                  onShare={
                    accepted && conn.data?.other
                      ? async () => {
                          if (!window.confirm(`Share this memory with ${first}? They'll be able to read it.`)) return;
                          const s = await Api.shareMemory(m.id, conn.data!.other!.id);
                          mems.setData((all) => (all ?? []).map((x) => (x.id === s.id ? { ...x, sharedWith: s.sharedWith } : x)));
                        }
                      : undefined
                  }
                  onDelete={async () => {
                    if (!window.confirm("Delete this memory? This can't be undone.")) return;
                    await Api.deleteMemory(m.id);
                    mems.setData((all) => (all ?? []).filter((x) => x.id !== m.id));
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
