import { useState } from "react";
import { Api, type ContactField } from "../lib/api";
import { useMe } from "../lib/me";
import Alert from "./Alert";
import Button from "./Button";
import Sheet from "./Sheet";
import ShareFields, { type Draft } from "./ShareFields";

// The share step before a Klick request or acceptance. Saves any contact detail added here to the profile first.
export default function ShareSheet({
  title,
  description,
  cta,
  withNote,
  onSubmit,
  onClose,
}: {
  title: string;
  description: string;
  cta: (n: number) => string;
  withNote?: boolean;
  onSubmit: (fields: ContactField[], note: string) => Promise<void>;
  onClose: () => void;
}) {
  const { me, setMe } = useMe();
  const saved = me?.contact ?? {};
  const [contact, setContact] = useState<Draft>(saved);
  // Starts from the member's "after you both accept" defaults; website and X have no default, so they follow what's filled in.
  const after: string[] | undefined = me?.sharing?.afterAccept;
  const [chosen, setChosen] = useState<Set<ContactField>>(
    () => new Set((Object.keys(saved) as ContactField[]).filter((k) => saved[k] && (!after || !["linkedin", "email", "phone"].includes(k) || after.includes(k)))),
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fields = [...chosen].filter((f) => contact[f]?.trim());

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const clean = Object.fromEntries(Object.entries(contact).map(([k, v]) => [k, v?.trim() ?? ""]).filter(([, v]) => v));
      if (JSON.stringify(clean) !== JSON.stringify(saved)) setMe(await Api.saveMe({ contact: clean }));
      await onSubmit(fields, note.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <Sheet title={title} description={description} onClose={onClose}>
      <ShareFields
        contact={contact}
        chosen={chosen}
        onChange={(c, s) => {
          setContact(c);
          setChosen(s);
        }}
      />
      {withNote && (
        <div className="k-q" style={{ marginTop: "var(--space-4)" }}>
          <label htmlFor="klick-note">
            <b>Add a note</b> <span className="k-muted">(optional)</span>
          </label>
          <input
            id="klick-note"
            className="pd-input"
            maxLength={280}
            placeholder="Loved your point on carbon data. Coffee after the talks?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      )}
      {error && (
        <div style={{ marginTop: "var(--space-4)" }}>
          <Alert tone="warning" title={error} />
        </div>
      )}
      <div className="pd-actions">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Not now
        </Button>
        <Button variant="brand" size="lg" loading={busy} onClick={submit}>
          {cta(fields.length)}
        </Button>
      </div>
    </Sheet>
  );
}
