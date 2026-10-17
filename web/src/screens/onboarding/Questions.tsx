import { useState } from "react";
import { Api, type Me, type Questionnaire } from "../../lib/api";
import { useMe } from "../../lib/me";
import Button from "../../ui/Button";
import ChipPicker from "../../ui/ChipPicker";
import SettingSwitch from "../../ui/Switch";
import Flow, { FlowError, useGo } from "./Flow";

const LOOKING_FOR = [
  "Co-founder",
  "Collaborators",
  "Mentor",
  "People to hire",
  "A new role",
  "Investors",
  "Users to talk to",
  "Friends in the field",
];
const OFFERING = [
  "Mentoring",
  "Design feedback",
  "Technical help",
  "Intros",
  "Hiring",
  "Product advice",
  "Speaking",
  "Funding",
];
const TOPICS = [
  "AI",
  "Accessibility",
  "Climate",
  "Healthcare",
  "Education",
  "Civic tech",
  "Design",
  "Open source",
  "Community",
];

// Step 6, last: what you're after and what you can give. Gemini uses only this, in your own words, to explain matches.
export default function Questions({ me }: { me: Me }) {
  const { setMe } = useMe();
  const { go } = useGo();
  const q = me.questionnaire;
  const [role, setRole] = useState(me.role);
  const [company, setCompany] = useState(me.company);
  const [lookingFor, setLookingFor] = useState<string[]>(q?.lookingFor ?? []);
  const [offering, setOffering] = useState<string[]>(q?.offering ?? []);
  const [topics, setTopics] = useState<string[]>(
    q?.topics.length ? q.topics : me.interests.slice(0, 15),
  );
  const [detail, setDetail] = useState(q?.lookingForDetail ?? "");
  const [style, setStyle] = useState<Questionnaire["meetingStyle"]>(
    q?.meetingStyle ?? "either",
  );
  const [findable, setFindable] = useState(
    me.defaultVisibility === "confirmed_attendees",
  );
  const [a11y, setA11y] = useState(me.accessibility);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      await Api.saveMe({
        role: role.trim(),
        company: company.trim(),
        headline: [role.trim(), company.trim()].filter(Boolean).join(" at "),
        interests: topics.map((t) => t.slice(0, 40)),
        accessibility: a11y,
        defaultVisibility: findable ? "confirmed_attendees" : "hidden",
        discoverability: findable ? "events" : "ask",
      });
      setMe(
        await Api.saveQuestionnaire({
          lookingFor,
          lookingForDetail: detail.trim(),
          offering,
          offeringDetail: "",
          topics: topics.map((t) => t.slice(0, 40)),
          meetingStyle: style,
        }),
      );
    } catch {
      setBusy(false);
      setError(
        "Couldn't save your answers. Check your connection, then retry. Nothing you typed is lost.",
      );
    }
  }

  const none = lookingFor.length + offering.length === 0;
  return (
    <Flow
      step={6}
      onBack={() => go("integrations")}
      title="Who do you want to meet?"
      sub="Klick uses your answers to suggest people and to explain why, in plain words. Matches see your role and company before a Klick, nothing else."
      foot={
        <>
          <FlowError>{error}</FlowError>
          <Button
            variant="primary"
            size="lg"
            loading={busy}
            disabled={none}
            onClick={save}
          >
            Finish
          </Button>
          <p className="k-caption k-center">
            {none
              ? "Pick at least one thing you're looking for or can offer."
              : "You can change these any time in your profile."}
          </p>
        </>
      }
    >
      <div className="pd-grid2 k-q">
        <div className="pd-field">
          <label htmlFor="role">Role</label>
          <input
            id="role"
            className="pd-input"
            value={role}
            maxLength={80}
            placeholder="Product designer"
            onChange={(e) => setRole(e.target.value)}
          />
        </div>
        <div className="pd-field">
          <label htmlFor="company">Company</label>
          <input
            id="company"
            className="pd-input"
            value={company}
            maxLength={80}
            placeholder="Fernwood Labs"
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>
      </div>

      <section className="k-q">
        <h2>I'm looking for</h2>
        <ChipPicker
          options={LOOKING_FOR}
          value={lookingFor}
          onChange={setLookingFor}
        />
        <div className="pd-field" style={{ marginTop: "var(--space-3)" }}>
          <label htmlFor="detail">In a sentence (optional)</label>
          <input
            id="detail"
            className="pd-input"
            value={detail}
            maxLength={500}
            placeholder="Someone who has run user research on a tiny budget"
            onChange={(e) => setDetail(e.target.value)}
          />
          <span className="pd-hint">
            Used to explain matches to you. Not shown on your profile.
          </span>
        </div>
      </section>

      <section className="k-q">
        <h2>I can offer</h2>
        <ChipPicker
          options={OFFERING}
          value={offering}
          onChange={setOffering}
        />
      </section>

      <section className="k-q">
        <h2>Topics I care about</h2>
        <ChipPicker
          options={TOPICS}
          value={topics}
          onChange={setTopics}
          max={15}
          addLabel="Add a topic"
        />
      </section>

      <section className="k-q">
        <h2>I prefer to meet</h2>
        <div className="pd-stack" role="radiogroup">
          {(
            [
              ["one_on_one", "One to one"],
              ["small_group", "In a small group"],
              ["either", "Either is fine"],
            ] as const
          ).map(([v, l]) => (
            <label key={v} className="pd-check">
              <input
                type="radio"
                name="style"
                checked={style === v}
                onChange={() => setStyle(v)}
              />
              <span>{l}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="k-q">
        <h2>Visibility</h2>
        <SettingSwitch
          label="Let people at my events find me"
          hint={
            findable
              ? "Other attendees who also opted in can see your role and company. You can change this per event."
              : "Nobody sees you until you turn this on for an event."
          }
          checked={findable}
          onChange={setFindable}
        />
      </section>

      <section className="k-q">
        <h2>Make Klick easier for me</h2>
        <SettingSwitch
          label="Simple language"
          hint="Shorter sentences in suggestions and drafts."
          checked={a11y.simpleLanguage}
          onChange={(v) => setA11y({ ...a11y, simpleLanguage: v })}
        />
        <SettingSwitch
          label="Read aloud"
          hint="A play button on match reasons and memories."
          checked={a11y.readAloud}
          onChange={(v) => setA11y({ ...a11y, readAloud: v })}
        />
        <SettingSwitch
          label="I prefer text first"
          hint="Suggest a message before meeting in person."
          checked={a11y.prefersTextFirst}
          onChange={(v) => setA11y({ ...a11y, prefersTextFirst: v })}
        />
        <SettingSwitch
          label="Quiet spaces"
          hint="Prefer meeting away from the busy areas."
          checked={a11y.quietSpaces}
          onChange={(v) => setA11y({ ...a11y, quietSpaces: v })}
        />
      </section>
    </Flow>
  );
}
