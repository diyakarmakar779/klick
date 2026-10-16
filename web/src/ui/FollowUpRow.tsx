import { useState } from "react";
import { Clock, Copy, Sparkles } from "lucide-react";
import { Api, type FollowUp } from "../lib/api";
import { dueLabel } from "../lib/followups";
import Button from "./Button";

// Follow-up intent. Gemini can draft a message, but the member copies and sends it themselves.
export default function FollowUpRow({ followUp, name, simpleLanguage, onChange }: { followUp: FollowUp; name: string; simpleLanguage: boolean; onChange: (f: FollowUp) => void }) {
  const [busy, setBusy] = useState<"draft" | "done" | "sent" | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const due = dueLabel(followUp.dueAt);
  const closed = ["done", "sent", "dismissed"].includes(followUp.status);

  async function run(which: "draft" | "done" | "sent", fn: () => Promise<FollowUp>) {
    setBusy(which);
    setError("");
    try {
      onChange(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="k-followup">
      <div className="pd-intent" style={{ marginTop: 0 }}>
        <button
          type="button"
          className="pd-intent__box"
          role="checkbox"
          aria-checked={closed}
          aria-label={`Mark "${followUp.reason}" done`}
          disabled={closed || busy !== null}
          onClick={() => run("done", () => Api.setFollowUp(followUp.id, "done"))}
        />
        <span style={closed ? { textDecoration: "line-through", color: "var(--muted-foreground)" } : undefined}>{followUp.reason}</span>
        {!closed && (
          <span className={`pd-intent__due ${due.overdue ? "k-overdue" : ""}`}>
            <Clock className="pd-i" aria-hidden="true" style={{ width: 13, height: 13 }} />
            {due.text}
          </span>
        )}
      </div>
      {!closed && followUp.draft && (
        <div className="k-draft">
          {followUp.whyNow && <small>{followUp.whyNow}</small>}
          <p>{followUp.draft}</p>
          <div className="pd-actions" style={{ marginTop: "var(--space-2)" }}>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard?.writeText(followUp.draft!).catch(() => {});
                setCopied(true);
              }}
            >
              <Copy className="pd-i" aria-hidden="true" />
              {copied ? "Copied" : "Copy message"}
            </Button>
            <Button variant="ghost" size="sm" loading={busy === "sent"} onClick={() => run("sent", () => Api.setFollowUp(followUp.id, "sent"))}>
              I sent it
            </Button>
          </div>
        </div>
      )}
      {!closed && !followUp.draft && (
        <Button variant="ghost" size="sm" loading={busy === "draft"} onClick={() => run("draft", () => Api.draftFollowUp(followUp.id, simpleLanguage))}>
          <Sparkles className="pd-i" aria-hidden="true" />
          Draft a message to {name}
        </Button>
      )}
      {error && <small className="k-error">{error}</small>}
    </div>
  );
}
