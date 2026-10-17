import { useState } from "react";
import { Eye } from "lucide-react";
import { Api, type Me } from "../../lib/api";
import Button from "../../ui/Button";
import Flow, { FlowError, useGo } from "./Flow";

const OPTIONS = [
  { value: "ask", title: "Ask me for each event", body: "Nobody sees you at an event until you opt in." },
  { value: "events", title: "Discoverable at my events", body: "Other members who opt in can see you at events you attend. You can opt out of any event." },
  { value: "never", title: "Never discoverable", body: "You can still meet people with your QR code." },
] as const;

// Step 6, continued: the default for being found at events. Only "Discoverable" turns visibility on.
export default function Discoverability({ me }: { me: Me }) {
  const { go, busy, error } = useGo();
  const [choice, setChoice] = useState<Me["discoverability"]>(me.discoverability ?? (me.defaultVisibility === "confirmed_attendees" ? "events" : "ask"));
  const save = () =>
    go("integrations", () => Api.saveMe({ discoverability: choice, defaultVisibility: choice === "events" ? "confirmed_attendees" : "hidden" }));
  return (
    <Flow
      step={6}
      onBack={() => go("sharing")}
      title="Who can find you at events?"
      sub="Choose your default. You can change it for any event."
      foot={
        <>
          <FlowError>{error}</FlowError>
          <Button variant="primary" size="lg" loading={busy} onClick={save}>
            Continue
          </Button>
        </>
      }
    >
      <div className="k-onb__body" role="radiogroup" aria-label="Who can find you at events">
        {OPTIONS.map((o) => (
          <label key={o.value} className="k-radio">
            <input type="radio" name="disc" checked={choice === o.value} onChange={() => setChoice(o.value)} />
            <span>
              <b>{o.title}</b>
              <span>{o.body}</span>
            </span>
          </label>
        ))}
        <p className="k-note k-note--privacy">
          <Eye className="pd-i" aria-hidden="true" />
          <span>Visible at an event means only the fields you chose to show before a Klick.</span>
        </p>
      </div>
    </Flow>
  );
}
