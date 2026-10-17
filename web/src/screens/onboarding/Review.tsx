import { Eye, Lock, Users } from "lucide-react";
import type { Me, ShareItem } from "../../lib/api";
import Button from "../../ui/Button";
import Flow, { FlowError, useGo } from "./Flow";
import { initials, myPhoto } from "./photo";

const LABEL: Record<ShareItem, string[]> = { photo: ["photo"], role_company: ["role", "company"], location: ["location"], linkedin: ["LinkedIn"], email: ["email"], phone: ["phone"] };

function list(items: string[]): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// After step 6: the profile as others will see it, and who sees what. Nothing new is saved here.
export default function Review({ me }: { me: Me }) {
  const { go, busy, error } = useGo();
  const photo = myPhoto(me);
  const before = ["name", ...(me.sharing?.beforeKlick ?? []).flatMap((k) => LABEL[k])];
  const added = (me.sharing?.afterAccept ?? []).filter((k) => !(me.sharing?.beforeKlick as string[] | undefined)?.includes(k)).flatMap((k) => LABEL[k]);
  const where =
    me.discoverability === "events" ? "at events you attend, unless you opt out" : me.discoverability === "never" ? "only when you show your QR code" : "only at events where you opt in";
  const work = [me.role, me.company].filter(Boolean).join(" at ");
  const q = me.questionnaire;

  return (
    <Flow
      onBack={() => go("integrations")}
      title="You're set up"
      sub="Here's your profile and who can see what. You can change any of it later."
      foot={
        <>
          <FlowError>{error}</FlowError>
          <Button variant="primary" size="lg" loading={busy} onClick={() => go("done")}>
            Go to Klick
          </Button>
          <Button variant="secondary" size="lg" disabled={busy} onClick={() => go("profile")}>
            Edit my setup
          </Button>
        </>
      }
    >
      <div className="k-review">
        {photo ? <img src={photo.url} alt="" referrerPolicy="no-referrer" /> : <span className="pd-avatar pd-avatar--brand">{initials(me.displayName)}</span>}
        <div className="k-grow">
          <b>{me.displayName}</b>
          {work && <p>{work}</p>}
          {me.location && <small>{me.location}</small>}
          {q && (
            <div className="k-tags">
              {q.topics.slice(0, 3).map((t) => (
                <span key={t} className="k-tag k-tag--on">
                  {t}
                </span>
              ))}
              {q.lookingFor.slice(0, 2).map((t) => (
                <span key={t} className="k-tag k-tag--grey">
                  Wants to meet {t.toLowerCase()}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <h2 className="k-onb__h">Who sees what</h2>
      <ul className="k-who">
        <li>
          <Eye className="pd-i" aria-hidden="true" />
          <div>
            <b>Before a Klick</b>
            <p>
              {cap(list(before))}, {where}.
            </p>
          </div>
        </li>
        <li>
          <Users className="pd-i" aria-hidden="true" />
          <div>
            <b>After you both accept</b>
            <p>{added.length ? `Adds your ${list(added)}.` : "Nothing more than before a Klick."}</p>
          </div>
        </li>
        <li>
          <Lock className="pd-i" aria-hidden="true" />
          <div>
            <b>Only you</b>
            <p>Your notes and voice memos.</p>
          </div>
        </li>
      </ul>
    </Flow>
  );
}
