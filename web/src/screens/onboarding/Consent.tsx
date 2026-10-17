import { CalendarDays, Eye, Lock, Send } from "lucide-react";
import Button from "../../ui/Button";
import Flow, { FlowError, useGo } from "./Flow";

const ITEMS = [
  { icon: CalendarDays, title: "Sources you connect", body: "Klick reads events from the calendar or event source you authorise. You can disconnect it any time." },
  { icon: Lock, title: "Memories stay private", body: "Notes and voice recordings are only yours. Nobody you meet sees them.", privacy: true },
  { icon: Eye, title: "You choose who finds you", body: "Other members see you at an event only if you opt in, and you can change it per event.", privacy: true },
  { icon: Send, title: "No automatic messages", body: "Klick can draft a follow-up. Nothing is sent unless you choose to send it." },
];

// Step 2: what Klick sees and shares, before any profile is set up.
export default function Consent() {
  const { go, busy, error } = useGo();
  return (
    <Flow
      step={2}
      onBack={() => go("account")}
      title="You decide what Klick sees and shares"
      sub="Four things to know before you set up your profile."
      foot={
        <>
          <FlowError>{error}</FlowError>
          <Button variant="primary" size="lg" loading={busy} onClick={() => go("identity")}>
            I understand, continue
          </Button>
          <a className="k-onb__link" href="/privacy.html">
            Read the privacy policy
          </a>
        </>
      }
    >
      <ul className="k-consent">
        {ITEMS.map(({ icon: Icon, title, body, privacy }) => (
          <li key={title}>
            <span className={`k-consent__icon${privacy ? " k-consent__icon--privacy" : ""}`}>
              <Icon className="pd-i" aria-hidden="true" />
            </span>
            <div>
              <b>{title}</b>
              <p>{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </Flow>
  );
}
