import { Lock } from "lucide-react";
import { CONTACT_FIELDS, type ContactField } from "../lib/api";
import { FIELD_LABEL, FIELD_PLACEHOLDER } from "../lib/people";

export type Draft = Partial<Record<ContactField, string>>;

// Field-by-field consent. Name is always shared. A field you haven't filled in can be added right here;
// typing a value switches it on, and nothing is shared until both people accept.
export default function ShareFields({
  contact,
  chosen,
  onChange,
}: {
  contact: Draft;
  chosen: Set<ContactField>;
  onChange: (contact: Draft, chosen: Set<ContactField>) => void;
}) {
  const toggle = (f: ContactField, on: boolean) => {
    const next = new Set(chosen);
    if (on) next.add(f);
    else next.delete(f);
    onChange(contact, next);
  };
  return (
    <div className="pd-share" style={{ marginTop: 8 }}>
      <div className="pd-setting">
        <span>Name</span>
        <span className="pd-locked">
          <Lock className="pd-i" aria-hidden="true" style={{ width: 13, height: 13 }} />
          Always shared
        </span>
      </div>
      {CONTACT_FIELDS.map((f) => {
        const value = contact[f]?.trim() ?? "";
        return (
          <div key={f} className="pd-setting k-share-row">
            <label className="k-grow" htmlFor={`share-${f}`}>
              {FIELD_LABEL[f]}
              <input
                id={`share-${f}`}
                className="k-share-input"
                value={contact[f] ?? ""}
                placeholder={`Add ${FIELD_PLACEHOLDER[f]}`}
                autoComplete={f === "email" ? "email" : f === "phone" ? "tel" : "off"}
                onChange={(e) => {
                  const v = e.target.value;
                  const next = new Set(chosen);
                  if (v.trim() && !contact[f]?.trim()) next.add(f);
                  if (!v.trim()) next.delete(f);
                  onChange({ ...contact, [f]: v }, next);
                }}
              />
            </label>
            <button
              type="button"
              className="pd-switch"
              role="switch"
              aria-checked={chosen.has(f) && !!value}
              aria-label={`Share ${FIELD_LABEL[f]}`}
              disabled={!value}
              onClick={() => toggle(f, !chosen.has(f))}
            />
          </div>
        );
      })}
    </div>
  );
}
