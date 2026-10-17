import { useState } from "react";
import { Check, Plus } from "lucide-react";

// Pick several short options, or add your own. Selection uses the brand tint, per the design system.
export default function ChipPicker({
  options,
  value,
  onChange,
  max = 8,
  addLabel = "Add your own",
  allowAdd = true,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
  addLabel?: string;
  allowAdd?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const all = [...options, ...value.filter((v) => !options.includes(v))];
  const toggle = (o: string) =>
    onChange(
      value.includes(o)
        ? value.filter((v) => v !== o)
        : value.length < max
          ? [...value, o]
          : value,
    );
  const add = () => {
    const t = draft.trim().slice(0, 60);
    if (t && !value.includes(t) && value.length < max) onChange([...value, t]);
    setDraft("");
  };
  return (
    <div>
      <div className="pd-chips" role="group">
        {all.map((o) => (
          <button
            key={o}
            type="button"
            className="k-chip"
            aria-pressed={value.includes(o)}
            onClick={() => toggle(o)}
          >
            {value.includes(o) && <Check className="pd-i" aria-hidden="true" />}
            {o}
          </button>
        ))}
      </div>
      {allowAdd && (
        <div className="k-chip-add">
          <input
            className="pd-input"
            value={draft}
            placeholder={addLabel}
            aria-label={addLabel}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <button
            type="button"
            className="pd-btn pd-btn--secondary pd-btn--icon"
            aria-label="Add"
            onClick={add}
          >
            <Plus className="pd-i" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
