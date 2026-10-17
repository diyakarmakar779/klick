import { useState } from "react";
import { Eye, Lock, Users } from "lucide-react";
import { Api, type Me, type ShareItem } from "../../lib/api";
import { auth } from "../../lib/firebase";
import Button from "../../ui/Button";
import Flow, { FlowError, useGo } from "./Flow";

type Before = Me["sharing"]["beforeKlick"][number];
const ROWS: Array<{ key: ShareItem; label: string; before: boolean }> = [
  { key: "photo", label: "Photo", before: true },
  { key: "role_company", label: "Role and company", before: true },
  { key: "location", label: "Location", before: true },
  { key: "linkedin", label: "LinkedIn", before: false },
  { key: "email", label: "Email", before: false },
  { key: "phone", label: "Phone", before: false },
];

// Step 6: what people see before a Klick and after you both accept. The name always shows;
// contact details can only be shared after both accept.
export default function Sharing({ me }: { me: Me }) {
  const { go, busy, error } = useGo();
  const [before, setBefore] = useState<Set<ShareItem>>(new Set(me.sharing?.beforeKlick ?? ["photo", "role_company"]));
  const [after, setAfter] = useState<Set<ShareItem>>(new Set(me.sharing?.afterAccept ?? ["photo", "role_company", "location", "linkedin"]));
  const [phone, setPhone] = useState(me.contact.phone ?? "");
  const flip = (set: Set<ShareItem>, key: ShareItem, put: (s: Set<ShareItem>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    put(next);
  };

  function save() {
    const contact = { ...me.contact };
    if (after.has("email") && !contact.email && auth.currentUser?.email) contact.email = auth.currentUser.email;
    if (phone.trim()) contact.phone = phone.trim();
    else delete contact.phone;
    const afterAccept = [...after].filter((k) => k !== "phone" || contact.phone);
    return go("discoverability", () =>
      Api.saveMe({ sharing: { beforeKlick: [...before].filter((k) => ROWS.find((r) => r.key === k)?.before) as Before[], afterAccept }, contact }),
    );
  }

  return (
    <Flow
      step={6}
      onBack={() => go("questionnaire")}
      title="Choose what people see"
      sub="Set your defaults. You can change what you share with each person later."
      foot={
        <>
          <FlowError>{error}</FlowError>
          <Button variant="primary" size="lg" loading={busy} onClick={save}>
            Continue
          </Button>
        </>
      }
    >
      <table className="k-share">
        <thead>
          <tr>
            <td style={{ border: 0 }} />
            <th scope="col">
              <Eye className="pd-i" aria-hidden="true" />
              Before a Klick
            </th>
            <th scope="col">
              <Users className="pd-i" aria-hidden="true" />
              After you both accept
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Name</td>
            <td>
              <input type="checkbox" checked disabled aria-label="Name before a Klick, always shown" />
            </td>
            <td>
              <input type="checkbox" checked disabled aria-label="Name after you both accept, always shown" />
            </td>
          </tr>
          {ROWS.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td>
                <input
                  type="checkbox"
                  checked={r.before && before.has(r.key)}
                  disabled={!r.before}
                  aria-label={r.before ? `${r.label} before a Klick` : `${r.label} is never shown before a Klick`}
                  onChange={() => flip(before, r.key, setBefore)}
                />
              </td>
              <td>
                <input type="checkbox" checked={after.has(r.key)} aria-label={`${r.label} after you both accept`} onChange={() => flip(after, r.key, setAfter)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {after.has("phone") && (
        <div className="pd-field" style={{ marginTop: "var(--space-4)" }}>
          <label htmlFor="s-phone">Your phone number</label>
          <input id="s-phone" className="pd-input" type="tel" autoComplete="tel" value={phone} placeholder="+91 98765 43210" onChange={(e) => setPhone(e.target.value)} />
          <span className="pd-hint">Only shared with people you both accept, and only if you leave Phone ticked.</span>
        </div>
      )}
      <p className="k-note k-note--privacy" style={{ marginTop: "var(--space-5)" }}>
        <Lock className="pd-i" aria-hidden="true" />
        <span>Contact details only show after you both accept. Notes and voice memos always stay private to you.</span>
      </p>
    </Flow>
  );
}
